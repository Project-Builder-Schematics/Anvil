import type { Input } from './schema.generated.ts';
import {
  SCOPE,
  ESLINT_CONFIG,
  TSCONFIG_BASE,
  addContextRelation,
  addModuleEntry,
  assertDashed,
  assertPascal,
  constant,
  dashed,
  pascal,
  docsDir,
  resolveSlice,
  row,
  withImports,
  writeBuffer,
  type WriteBuffer,
} from '../_shared/lib.ts';

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
import type * as ${provider} from '${SCOPE}/api-${provider}';
import type { ${name} } from '../domain/driven-ports/${name}';

// Translates this port into ${provider}'s language: the only file of the slice that knows its barrel.
export type ${pascal(provider)}Api = typeof ${provider};

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

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const context = assertDashed(input.context, 'context');
  const name = assertPascal(input.name, 'name');
  const { code, docs } = await resolveSlice(
    context,
    assertDashed(input.slice, 'slice'),
    buffer,
  );
  const compositionPath = `${code}/composition.ts`;
  const composition = await buffer.readRequired(
    compositionPath,
    `create the slice first: hex-slice --context=${context} --slice=${input.slice}`,
  );
  // Already generated: a re-run (hex-subdomain after a doc change) leaves it alone.
  if (
    (await buffer.read(`${code}/domain/driven-ports/${name}.ts`)) !== undefined
  )
    return;

  const model = await buffer.readRequired(
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
    const tsconfig = await buffer.readRequired(
      TSCONFIG_BASE,
      'the provider alias is read from the workspace tsconfig',
    );
    if (!tsconfig.includes(`"${alias}":`))
      throw new Error(
        `${alias} is not registered in ${TSCONFIG_BASE} — create the context first`,
      );
    const readmePath = `${docsDir(context)}/README.md`;
    const readme = await buffer.readRequired(
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
  await buffer.write(
    `${code}/domain/driven-ports/${name}.ts`,
    portSource(name),
  );
  await buffer.write(
    `${code}/infrastructure/${adapter}.ts`,
    kind === 'context' ? contextAdapter(name, provider) : memoryAdapter(name),
  );
  if (kind === 'context')
    await buffer.write(
      ESLINT_CONFIG,
      addContextRelation(
        await buffer.readRequired(
          ESLINT_CONFIG,
          'the relation is declared in the lint boundaries',
        ),
        context,
        provider,
      ),
    );
  const token = constant(dashed(name));
  await buffer.write(
    compositionPath,
    addModuleEntry(
      withImports(composition, [
        `import { ${token} } from './domain/driven-ports/${name}';`,
        `import { ${adapter} } from './infrastructure/${adapter}';`,
      ]),
      'providers',
      `{ provide: ${token}, useClass: ${adapter} }`,
    ),
  );
  if (!shared) buffer.flush();
};
