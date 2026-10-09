import type { Input } from './schema.generated.ts';
import { create, find } from '@pbuilder/sdk/commons';
import { astLibrary } from '@pbuilder/sdk/typescript';
import {
  ESLINT_CONFIG,
  TSCONFIG_BASE,
  apiAlias,
  assertDashed,
  assertPascal,
  camel,
  constant,
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

const DOC_CELL = /^(?:Memory\b|@([a-z][a-z0-9-]*)\b)/;

/** What the doc's Adapter today cell says answers the port: `@<context>` gives that provider, `Memory …` gives '', anything else undefined. */
const providerFromDoc = (cell: string | undefined): string | undefined => {
  const match = DOC_CELL.exec(cell ?? '');
  return match ? (match[1] ?? '') : undefined;
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
  const provider = providerFromDoc(row(model, 'Driven ports', name)?.[2]);
  if (provider === undefined) {
    throw new Error(
      `start the Adapter today cell of ${name} in domain-model.md with Memory or @<context>`,
    );
  }
  if (provider !== '') {
    if (provider === context)
      throw new Error(`${context} cannot be its own provider`);
    const alias = apiAlias(provider);
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

  const adapter = provider ? `${pascal(provider)}${name}` : `Memory${name}`;
  const token = constant(dashed(name));
  if (provider && name === 'Api')
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
    create(portPath, {
      templateFile: 'files/port/port.ts.template',
      options: { name, token },
    });
  if (existingAdapter === undefined)
    create(adapterPath, {
      templateFile: provider
        ? 'files/port/context-adapter.ts.template'
        : 'files/port/memory-adapter.ts.template',
      options: provider
        ? {
            name,
            provider,
            providerClass: pascal(provider),
            api: camel(pascal(provider)),
            alias: apiAlias(provider),
          }
        : { name },
    });
  if (provider) {
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
