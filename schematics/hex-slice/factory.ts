import type { Input } from './schema.generated.ts';
import { find } from '@pbuilder/sdk/commons';
import { RINGS } from '../_shared/libs.ts';
import {
  apiLibDir,
  assertDashed,
  constant,
  createFile,
  errorCodes,
  pascal,
  readRequired,
  resolveSlice,
} from '../_shared/lib.ts';
import { addModuleEntry, startRun, withAst, type Run } from '../_shared/ts.ts';

const errorsSource = (
  slice: string,
  context: string,
  codes: string[],
): string =>
  codes.length === 0
    ? `export const ${constant(slice)}_ERROR = {} as const;\n`
    : `export const ${constant(slice)}_ERROR = {\n${codes.map((code) => `  ${code}: '${context}.${code.toLowerCase()}',`).join('\n')}\n} as const;\n`;

export default async (input: Input, shared?: Run) => {
  const run = shared ?? startRun();
  const context = assertDashed(input.context, 'context');
  const slice = assertDashed(input.slice, 'slice');
  const lib = apiLibDir(context);

  await readRequired(
    `${lib}/src/index.ts`,
    `create the context first: hex-bounded-context --context=${context}`,
  );
  const { code, docs, segment } = await resolveSlice(context, slice);
  const model = await readRequired(
    `${docs}/domain-model.md`,
    'the slice is generated from its domain model',
  );

  // Already generated: a re-run (hex-subdomain after a doc change) only registers what is new.
  if ((await find(`${code}/domain/errors.ts`).read()) !== undefined) return;
  createFile(
    `${code}/domain/errors.ts`,
    errorsSource(slice, context, errorCodes(model)),
  );

  if (segment !== '') {
    const module = `${pascal(slice)}Module`;
    for (const ring of RINGS) createFile(`${code}/${ring}/.gitkeep`, '');
    createFile(
      `${code}/composition.ts`,
      `import { Module } from '@nestjs/common';\n\n@Module({})\nexport class ${module} {}\n`,
    );
    const contextModule = `${lib}/src/composition.ts`;
    await readRequired(
      contextModule,
      `create the context first: hex-bounded-context --context=${context}`,
    );
    run.edit(contextModule, (file) => {
      file.addImport(module, `./${slice}/composition`);
      return withAst(file, (ast) => {
        addModuleEntry(ast, 'imports', module);
        addModuleEntry(ast, 'exports', module);
      });
    });
  }
  if (!shared) await run.flush();
};
