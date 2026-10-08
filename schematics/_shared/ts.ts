// Edits to existing TypeScript and JavaScript files, through the SDK's typescript dialect.

import { astLibrary, find } from '@pbuilder/sdk/typescript';

const { Node, SyntaxKind } = astLibrary;

type Ast = astLibrary.SourceFile;
export type TsFile = ReturnType<typeof find>;

export interface Run {
  /** Queues edits for a path; they apply on one handle at `flush`, in the order queued. */
  edit(path: string, apply: (file: TsFile) => unknown): void;
  /** Runs `step`, naming it in any error it raises now or when its queued edits apply. */
  within(label: string, step: () => Promise<void>): Promise<void>;
  flush(): Promise<void>;
}

type Queued = { apply: (file: TsFile) => unknown; label?: string };

const labelled = (label: string | undefined, error: unknown): unknown =>
  label === undefined
    ? error
    : new Error(`${label}: ${(error as Error).message}`);

/**
 * The engine takes one write directive per path per run, and every read flushes all the open
 * handles, so a path cannot be edited again after anything has been read. A run therefore does
 * its reads first and queues its edits; `flush` opens one handle per path, applies that path's
 * edits and moves on, so a path is written once however many leaf factories edit it.
 */
export const startRun = (): Run => {
  const queue = new Map<string, Queued[]>();
  let label: string | undefined;
  return {
    edit: (path, apply) => {
      queue.set(path, [
        ...(queue.get(path) ?? []),
        { apply, ...(label === undefined ? {} : { label }) },
      ]);
    },
    within: async (name, step) => {
      label = name;
      try {
        await step();
      } catch (error) {
        throw labelled(name, error);
      } finally {
        label = undefined;
      }
    },
    flush: async () => {
      for (const [path, edits] of queue) {
        const file = find(path);
        for (const edit of edits) {
          try {
            await edit.apply(file);
          } catch (error) {
            throw labelled(edit.label, error);
          }
        }
        await file;
      }
      queue.clear();
    },
  };
};

/**
 * Runs `fn` on the file's live AST and returns what it gave. `.modify()` replaces the message
 * of whatever its callback throws with a generic one, so the error is carried out and rethrown.
 */
export const withAst = async <T>(
  file: TsFile,
  fn: (ast: Ast) => T,
): Promise<T> => {
  let outcome: { value: T } | { error: unknown } | undefined;
  await file.modify((ast) => {
    try {
      outcome = { value: fn(ast) };
    } catch (error) {
      outcome = { error };
    }
  });
  if (outcome === undefined) throw new Error('the edit did not run');
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
};

const squash = (text: string): string => text.replace(/\s+/g, '');

/** The `[…]` assigned to `const <name> =`, or a refusal naming the list. */
const arrayOf = (ast: Ast, name: string): astLibrary.ArrayLiteralExpression => {
  const list = ast
    .getVariableDeclaration(name)
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!list)
    throw new Error(
      `eslint.config.mjs has no \`const ${name} = [...]\` list to extend`,
    );
  return list;
};

const MODULE_KEYS = ['imports', 'controllers', 'providers', 'exports'] as const;
type ModuleKey = (typeof MODULE_KEYS)[number];

/** Adds `entry` to one array of the file's `@Module({…})` metadata, creating the array in the keys' usual order. */
export const addModuleEntry = (
  ast: Ast,
  key: ModuleKey,
  entry: string,
): void => {
  const config = ast
    .getClasses()
    .flatMap((cls) => cls.getDecorators())
    .find((decorator) => decorator.getName() === 'Module')
    ?.getArguments()[0];
  if (!config || !Node.isObjectLiteralExpression(config))
    throw new Error('no @Module({…}) decorator to extend');

  const before = MODULE_KEYS.slice(0, MODULE_KEYS.indexOf(key));
  const property =
    config.getProperty(key) ??
    config.insertPropertyAssignment(
      config
        .getProperties()
        .filter((p) => before.some((k) => k === p.getSymbol()?.getName()))
        .length,
      { name: key, initializer: '[]' },
    );
  const list = Node.isPropertyAssignment(property)
    ? property.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)
    : undefined;
  if (!list) throw new Error(`@Module ${key} is not an array literal`);
  if (!list.getElements().some((e) => squash(e.getText()) === squash(entry)))
    list.addElement(entry);
};

/** Re-exports `from` (`export * from`, or `export [type] { names } from`), once; the empty-module placeholder goes. */
export const addReExport = (
  ast: Ast,
  from: string,
  names?: string[],
  typeOnly = false,
): void => {
  const present = ast
    .getExportDeclarations()
    .some(
      (d) =>
        d.getModuleSpecifierValue() === from &&
        d.isTypeOnly() === typeOnly &&
        (names === undefined
          ? d.isNamespaceExport()
          : names.every((n) =>
              d.getNamedExports().some((e) => e.getName() === n),
            )),
    );
  if (present) return;
  ast
    .getExportDeclarations()
    .find((d) => !d.hasModuleSpecifier() && d.getNamedExports().length === 0)
    ?.remove();
  ast.addExportDeclaration({
    moduleSpecifier: from,
    isTypeOnly: typeOnly,
    ...(names ? { namedExports: names } : {}),
  });
};

/** Registers a bounded context in the root lint config's `contexts` list, which feeds the module-boundary constraints. */
export const addLintContext = (ast: Ast, context: string): void => {
  const list = arrayOf(ast, 'contexts');
  const present = list
    .getElements()
    .some((e) => Node.isStringLiteral(e) && e.getLiteralValue() === context);
  if (!present) list.addElement(`'${context}'`);
};

/** Declares in the root lint config that `from` may depend on `to`'s barrel; the module-boundary constraints are built from this list. */
export const addContextRelation = (
  ast: Ast,
  from: string,
  to: string,
): void => {
  const list = arrayOf(ast, 'contextRelations');
  const edges = list.getElements().map((entry) => {
    const pair = Node.isArrayLiteralExpression(entry)
      ? entry.getElements()
      : [];
    const [a, b] = pair;
    if (
      pair.length !== 2 ||
      !Node.isStringLiteral(a) ||
      !Node.isStringLiteral(b)
    )
      throw new Error(
        "contextRelations has an entry that is not a ['from', 'to'] pair of names",
      );
    return [a.getLiteralValue(), b.getLiteralValue()];
  });
  if (!edges.some(([a, b]) => a === from && b === to))
    list.addElement(`['${from}', '${to}']`);
};
