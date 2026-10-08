import type { Input } from './schema.generated.ts';
import { find } from '@pbuilder/sdk/commons';
import {
  DOMAIN_MODEL,
  apiLibDir,
  assertDashed,
  assertPascal,
  camel,
  constant,
  createFile,
  dashed,
  docsDir,
  readRequired,
  resolveSlice,
  row,
  table,
} from '../_shared/lib.ts';
import { stepsSource } from '../_shared/gherkin.ts';
import {
  addModuleEntry,
  addReExport,
  startRun,
  withAst,
  type Run,
} from '../_shared/ts.ts';

const asPorts = (spec: string): string[] =>
  spec
    .split(',')
    .map((port) => port.trim())
    .filter(Boolean)
    .map((port) => assertPascal(port, 'driven port'));

const useCaseSource = (name: string, ports: string[]): string => {
  const imports = [...ports]
    .sort()
    .map(
      (port) =>
        `import type { ${port} } from '../domain/driven-ports/${port}';`,
    )
    .join('\n');
  const params = ports.map((port) => `${camel(port)}: ${port}`).join(', ');
  return `/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
${imports}${imports ? '\n\n' : ''}export interface ${name}Command {}

export interface ${name}Result {}

export type ${name} = (command: ${name}Command) => Promise<${name}Result>;

export const ${constant(dashed(name))} = Symbol('${name}');

export const make${name} =
  (${params}): ${name} =>
  () =>
    Promise.reject(new Error('${name} is not implemented'));
`;
};

/**
 * The steps files of every other use case of the context. The lib loads them all, so a
 * phrase bound in one of them, in any subdomain, cannot be bound again.
 */
const siblingSteps = async (
  context: string,
  segment: string,
  own: { code: string; docs: string; stepsFile: string },
): Promise<string[]> => {
  const readme = (await find(`${docsDir(context)}/README.md`).read()) ?? '';
  const slices =
    segment === ''
      ? [own]
      : table(readme, 'Subdomains').flatMap((cells) => {
          const sub = /^\[?([a-z][a-z0-9-]*)/.exec(cells[0] ?? '')?.[1];
          return sub
            ? [
                {
                  code: `${apiLibDir(context)}/src/${sub}`,
                  docs: `${docsDir(context)}/${sub}`,
                },
              ]
            : [];
        });
  const files = await Promise.all(
    slices.map(async ({ code, docs }) =>
      table((await find(`${docs}/${DOMAIN_MODEL}`).read()) ?? '', 'Use cases')
        .map((r) => `${code}/steps/${r[0] ?? ''}.steps.ts`)
        .filter((file) => file !== own.stepsFile),
    ),
  );
  return Promise.all(
    files.flat().map(async (file) => (await find(file).read()) ?? ''),
  );
};

export default async (input: Input, shared?: Run) => {
  const run = shared ?? startRun();
  const context = assertDashed(input.context, 'context');
  const slice = assertDashed(input.slice, 'slice');
  const name = assertPascal(input.name, 'name');

  const { code, docs, segment } = await resolveSlice(context, slice);
  const compositionPath = `${code}/composition.ts`;
  const indexPath = `${apiLibDir(context)}/src/index.ts`;
  await readRequired(
    compositionPath,
    `create the slice first: hex-slice --context=${context} --slice=${slice}`,
  );
  await readRequired(
    indexPath,
    `create the context first: hex-bounded-context --context=${context}`,
  );
  // Already generated: a re-run (hex-subdomain after a doc change) leaves it alone.
  if ((await find(`${code}/application/${name}.ts`).read()) !== undefined)
    return;

  const model = await readRequired(
    `${docs}/${DOMAIN_MODEL}`,
    'the use case is generated from its domain model',
  );
  // The doc's row decides the ports and the feature; a flag may only agree with it.
  const documented = row(model, 'Use cases', name);
  if (!documented)
    throw new Error(
      `${name} is not in the Use cases table of ${docs}/${DOMAIN_MODEL} — add its row to the docs first`,
    );
  const docPorts = asPorts(documented[3] ?? '');
  const ports = input.driven_ports ? asPorts(input.driven_ports) : docPorts;
  if ([...ports].sort().join() !== [...docPorts].sort().join()) {
    throw new Error(
      `${name} lists ${docPorts.join(', ') || 'no ports'} in ${DOMAIN_MODEL}, not ${ports.join(', ')} — fix the doc or the flag`,
    );
  }
  for (const port of ports) {
    if (
      (await find(`${code}/domain/driven-ports/${port}.ts`).read()) ===
      undefined
    ) {
      throw new Error(
        `no driven port ${port} in ${code} — run hex-driven-port --name=${port} first`,
      );
    }
  }

  const featureFile =
    /\(([^)]+\.feature)\)/.exec(documented[4] ?? '')?.[1] ??
    `${dashed(name)}.feature`;
  // Docs are the contract: a row that links a feature the docs don't have is a gap in the doc,
  // never something for the generator to invent.
  const feature = await find(`${docs}/${featureFile}`).read();
  if (feature === undefined) {
    throw new Error(
      `hex-use-case: ${docs}/${featureFile} does not exist — the use-case row links a feature the docs do not have`,
    );
  }
  const siblings = await siblingSteps(context, segment, {
    code,
    docs,
    stepsFile: `${code}/steps/${name}.steps.ts`,
  });

  createFile(`${code}/application/${name}.ts`, useCaseSource(name, ports));
  createFile(`${code}/steps/${name}.steps.ts`, stepsSource(feature, siblings));

  const token = constant(dashed(name));
  const tokens = ports.map((port) => constant(dashed(port)));
  run.edit(compositionPath, (file) => {
    file.addImport(token, `./application/${name}`);
    file.addImport(`make${name}`, `./application/${name}`);
    ports.forEach((port, i) => {
      file.addImport(tokens[i] ?? '', `./domain/driven-ports/${port}`);
    });
    return withAst(file, (ast) => {
      addModuleEntry(
        ast,
        'providers',
        `{ provide: ${token}, useFactory: make${name}, inject: [${tokens.join(', ')}] }`,
      );
      addModuleEntry(ast, 'exports', token);
    });
  });
  run.edit(indexPath, (file) =>
    withAst(file, (ast) => {
      const from = `./${segment}application/${name}`;
      addReExport(ast, from, [token]);
      addReExport(ast, from, [name, `${name}Command`, `${name}Result`], true);
    }),
  );
  if (!shared) await run.flush();
};
