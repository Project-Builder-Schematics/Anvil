import type { Input } from './schema.generated.ts';
import { find } from '@pbuilder/sdk/commons';
import { astLibrary } from '@pbuilder/sdk/typescript';
import {
  SCOPE,
  ESLINT_CONFIG,
  TSCONFIG_BASE,
  assertDashed,
  assertPascal,
  camel,
  constant,
  createFile,
  dashed,
  pascal,
  docsDir,
  readRequired,
  resolveSlice,
  row,
} from '../_shared/lib.ts';
import {
  addContextRelation,
  addModuleEntry,
  startRun,
  withAst,
  type Run,
} from '../_shared/ts.ts';

type Kind = 'memory' | 'context';

const portSource = (
  name: string,
): string => `/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface -- placeholder until the Answers column of the domain model is declared here */
export interface ${name} {}

export const ${constant(dashed(name))} = Symbol('${name}');
`;

const memoryAdapter = (
  name: string,
): string => `import { Injectable } from '@nestjs/common';
import type { ${name} } from '../domain/driven-ports/${name}';

@Injectable()
export class Memory${name} implements ${name} {}
`;

const contextAdapter = (
  name: string,
  provider: string,
): string => `import { Injectable } from '@nestjs/common';
import type * as ${camel(pascal(provider))} from '${SCOPE}/api-${provider}';
import type { ${name} } from '../domain/driven-ports/${name}';

// Translates this port into ${provider}'s language: the only file of the slice that knows its barrel.
export type ${pascal(provider)}Api = typeof ${camel(pascal(provider))};

@Injectable()
export class ${pascal(provider)}${name} implements ${name} {}
`;

const DOC_CELL = /^(Memory)\b|^@([a-z][a-z0-9-]*)\b/;

/** The doc's Adapter today cell starts with what answers the port: `Memory …` or `@<context>`. */
const kindFromDoc = (
  cell: string | undefined,
): { kind: Kind; provider: string } | undefined => {
  const [, memory, context] = DOC_CELL.exec(cell ?? '') ?? [];
  if (memory) return { kind: 'memory', provider: '' };
  if (context) return { kind: 'context', provider: context };
  return undefined;
};

export default async (input: Input, shared?: Run) => {
  const run = shared ?? startRun();
  const context = assertDashed(input.context, 'context');
  const name = assertPascal(input.name, 'name');
  const { code, docs } = await resolveSlice(
    context,
    assertDashed(input.slice, 'slice'),
  );
  const compositionPath = `${code}/composition.ts`;
  await readRequired(
    compositionPath,
    `create the slice first: hex-slice --context=${context} --slice=${input.slice}`,
  );
  const model = await readRequired(
    `${docs}/domain-model.md`,
    'the port is generated from its domain model',
  );
  const documented = kindFromDoc(row(model, 'Driven ports', name)?.[2]);
  if (!input.kind && !documented) {
    throw new Error(
      `pass --kind, or start the Adapter today cell of ${name} in domain-model.md with Memory or @<context>`,
    );
  }
  const kind = input.kind ?? documented?.kind ?? 'memory';
  const provider = (input.provider || documented?.provider || '').trim();
  if (kind === 'context') {
    if (!provider)
      throw new Error(
        'kind=context needs provider (the context whose barrel the adapter calls, e.g. ledger)',
      );
    if (provider === context)
      throw new Error(`${context} cannot be its own provider`);
    const alias = `${SCOPE}/api-${provider}`;
    const tsconfig = await readRequired(
      TSCONFIG_BASE,
      'the provider alias is read from the workspace tsconfig',
    );
    if (!tsconfig.includes(`"${alias}":`))
      throw new Error(
        `${alias} is not registered in ${TSCONFIG_BASE} — create the context first`,
      );
    const readmePath = `${docsDir(context)}/README.md`;
    const readme = await readRequired(
      readmePath,
      'the context map declares which contexts this one may depend on',
    );
    if (!row(readme, 'Context map', provider))
      throw new Error(
        `${provider} is not in the Context map of ${readmePath} — declare the relation there first`,
      );
  }
  if (input.kind && documented) {
    const given = input.kind === 'context' ? `@${provider}` : 'Memory';
    const doc =
      documented.kind === 'context' ? `@${documented.provider}` : 'Memory';
    if (doc !== given)
      throw new Error(
        `${name} is ${doc} in domain-model.md, not ${given} — fix the doc or the flag`,
      );
  }

  const adapter =
    kind === 'context' ? `${pascal(provider)}${name}` : `Memory${name}`;
  const token = constant(dashed(name));
  if (kind === 'context' && name === 'Api')
    throw new Error(
      `${adapter} is the type that adapter exports for the provider barrel — rename the port`,
    );
  const adapterPath = `${code}/infrastructure/${adapter}.ts`;
  const portPath = `${code}/domain/driven-ports/${name}.ts`;
  // A re-run (hex-subdomain after a doc change) keeps existing files, hand-edited or not; an adapter is this port's only if it implements it.
  const existingAdapter = await find(adapterPath).read();
  if (
    existingAdapter !== undefined &&
    !new RegExp(`\\bimplements ${name}\\b`).test(existingAdapter)
  )
    throw new Error(`${adapterPath} already exists for another port`);
  if ((await find(portPath).read()) === undefined)
    createFile(portPath, portSource(name));
  if (existingAdapter === undefined)
    createFile(
      adapterPath,
      kind === 'context' ? contextAdapter(name, provider) : memoryAdapter(name),
    );
  if (kind === 'context') {
    await readRequired(
      ESLINT_CONFIG,
      'the relation is declared in the lint boundaries',
    );
    run.edit(ESLINT_CONFIG, (file) =>
      withAst(file, (ast) => {
        addContextRelation(ast, context, provider);
      }),
    );
  }
  const portModule = `./domain/driven-ports/${name}`;
  run.edit(compositionPath, async (file) => {
    const { taken, provided } = await withAst(file, (ast) => ({
      taken: ast
        .getImportDeclarations()
        .some(
          (d) =>
            d.getModuleSpecifierValue() !== portModule &&
            d.getNamedImports().some((n) => n.getName() === token),
        ),
      provided: ast
        .getDescendantsOfKind(astLibrary.SyntaxKind.ObjectLiteralExpression)
        .find(
          (o) => o.getProperty('provide')?.getText() === `provide: ${token}`,
        )
        ?.getProperty('useClass')
        ?.getText()
        .replace(/^useClass:\s*/, ''),
    }));
    if (taken)
      throw new Error(
        `${token} is already taken by another port of ${code} — rename ${name}`,
      );
    if (provided && provided !== adapter)
      throw new Error(
        `${token} is already provided by ${provided} in ${compositionPath} — fix the doc or remove it first`,
      );
    file.addImport(token, portModule);
    file.addImport(adapter, `./infrastructure/${adapter}`);
    await withAst(file, (ast) => {
      addModuleEntry(
        ast,
        'providers',
        `{ provide: ${token}, useClass: ${adapter} }`,
      );
    });
  });
  if (!shared) await run.flush();
};
