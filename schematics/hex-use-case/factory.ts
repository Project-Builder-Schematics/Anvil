import type { Input } from './schema.generated.ts';
import {
  DOMAIN_MODEL,
  addModuleEntry,
  apiLibDir,
  assertDashed,
  assertPascal,
  camel,
  constant,
  dashed,
  resolveSlice,
  row,
  table,
  withImports,
  withStatement,
  writeBuffer,
  type WriteBuffer,
} from '../_shared/lib.ts';
import { stepsSource } from '../_shared/gherkin.ts';

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

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const context = assertDashed(input.context, 'context');
  const slice = assertDashed(input.slice, 'slice');
  const name = assertPascal(input.name, 'name');

  const { code, docs, segment } = await resolveSlice(context, slice, buffer);
  const compositionPath = `${code}/composition.ts`;
  const indexPath = `${apiLibDir(context)}/src/index.ts`;
  const composition = await buffer.readRequired(
    compositionPath,
    `create the slice first: hex-slice --context=${context} --slice=${slice}`,
  );
  const index = await buffer.readRequired(
    indexPath,
    `create the context first: hex-bounded-context --context=${context}`,
  );
  // Already generated: a re-run (hex-subdomain after a doc change) leaves it alone.
  if ((await buffer.read(`${code}/application/${name}.ts`)) !== undefined)
    return;

  const model = await buffer.readRequired(
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
      (await buffer.read(`${code}/domain/driven-ports/${port}.ts`)) ===
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
  const feature = await buffer.read(`${docs}/${featureFile}`);
  if (feature === undefined) {
    throw new Error(
      `hex-use-case: ${docs}/${featureFile} does not exist — the use-case row links a feature the docs do not have`,
    );
  }
  const siblings = await Promise.all(
    table(model, 'Use cases')
      .map((r) => r[0] ?? '')
      .filter((useCase) => useCase !== name)
      .map((useCase) =>
        buffer
          .read(`${code}/steps/${useCase}.steps.ts`)
          .then((source) => source ?? ''),
      ),
  );

  await buffer.write(
    `${code}/application/${name}.ts`,
    useCaseSource(name, ports),
  );
  await buffer.write(
    `${code}/steps/${name}.steps.ts`,
    stepsSource(feature, siblings),
  );

  const token = constant(dashed(name));
  const tokens = ports.map((port) => constant(dashed(port)));
  const imported = withImports(composition, [
    `import { ${token}, make${name} } from './application/${name}';`,
    ...ports.map(
      (port, i) =>
        `import { ${tokens[i] ?? ''} } from './domain/driven-ports/${port}';`,
    ),
  ]);
  await buffer.write(
    compositionPath,
    addModuleEntry(
      addModuleEntry(
        imported,
        'providers',
        `{ provide: ${token}, useFactory: make${name}, inject: [${tokens.join(', ')}] }`,
      ),
      'exports',
      token,
    ),
  );
  await buffer.write(
    indexPath,
    withStatement(
      withStatement(
        index,
        `export { ${token} } from './${segment}application/${name}';`,
      ),
      `export type { ${name}, ${name}Command, ${name}Result } from './${segment}application/${name}';`,
    ),
  );
  if (!shared) buffer.flush();
};
