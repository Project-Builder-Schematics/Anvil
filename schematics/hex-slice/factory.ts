import type { Input } from './schema.generated.ts';
import { create, find, scaffold } from '@pbuilder/sdk/commons';
import {
  apiLibDir,
  assertDashed,
  constant,
  errorClass,
  errorCodes,
  pascal,
  readRequired,
  resolveSlice,
} from '../_shared/lib.ts';
import { addModuleEntry, startRun, withAst, type Run } from '../_shared/ts.ts';

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
  const codes = errorCodes(model);
  create(`${code}/domain/errors.ts`, {
    templateFile:
      codes.length === 0
        ? 'files/slice/errors-empty.ts.template'
        : 'files/slice/errors.ts.template',
    options: {
      errors: `${constant(slice)}_ERROR`,
      cls: errorClass(slice),
      codes: codes.map((name) => ({
        code: name,
        message: `${context}.${name.toLowerCase()}`,
      })),
    },
  });

  if (segment !== '') {
    const module = `${pascal(slice)}Module`;
    scaffold({ from: 'files/slice/rings', to: code, options: {} });
    create(`${code}/composition.ts`, {
      templateFile: 'files/slice/composition.ts.template',
      options: { module },
    });
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
