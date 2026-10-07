import type { Input } from './schema.generated.ts';
import { RINGS } from '../_shared/libs.ts';
import {
  addModuleEntry,
  apiLibDir,
  assertDashed,
  constant,
  errorCodes,
  pascal,
  resolveSlice,
  withImports,
  writeBuffer,
  type WriteBuffer,
} from '../_shared/lib.ts';

const errorsSource = (
  slice: string,
  context: string,
  codes: string[],
): string =>
  codes.length === 0
    ? `export const ${constant(slice)}_ERROR = {} as const;\n`
    : `export const ${constant(slice)}_ERROR = {\n${codes.map((code) => `  ${code}: '${context}.${code.toLowerCase()}',`).join('\n')}\n} as const;\n`;

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const context = assertDashed(input.context, 'context');
  const slice = assertDashed(input.slice, 'slice');
  const lib = apiLibDir(context);

  await buffer.readRequired(
    `${lib}/src/index.ts`,
    `create the context first: hex-bounded-context --context=${context}`,
  );
  const { code, docs, segment } = await resolveSlice(context, slice, buffer);
  const model = await buffer.readRequired(
    `${docs}/domain-model.md`,
    'the slice is generated from its domain model',
  );

  // Already generated: a re-run (hex-subdomain after a doc change) only registers what is new.
  if ((await buffer.read(`${code}/domain/errors.ts`)) !== undefined) return;
  await buffer.write(
    `${code}/domain/errors.ts`,
    errorsSource(slice, context, errorCodes(model)),
  );

  if (segment !== '') {
    const module = `${pascal(slice)}Module`;
    for (const ring of RINGS)
      await buffer.write(`${code}/${ring}/.gitkeep`, '');
    await buffer.write(
      `${code}/composition.ts`,
      `import { Module } from '@nestjs/common';\n\n@Module({})\nexport class ${module} {}\n`,
    );
    const contextModule = await buffer.readRequired(
      `${lib}/src/composition.ts`,
      `create the context first: hex-bounded-context --context=${context}`,
    );
    const imported = withImports(contextModule, [
      `import { ${module} } from './${slice}/composition';`,
    ]);
    await buffer.write(
      `${lib}/src/composition.ts`,
      addModuleEntry(
        addModuleEntry(imported, 'imports', module),
        'exports',
        module,
      ),
    );
  }
  if (!shared) buffer.flush();
};
