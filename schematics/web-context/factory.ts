import type { Input } from './schema.generated.ts';
import {
  ESLINT_CONFIG,
  SCOPE,
  TSCONFIG_BASE,
  addTsPath,
  assertDashed,
  createFile,
  readRequired,
  rewrite,
} from '../_shared/lib.ts';
import { webLibFiles, type WebLayer } from '../_shared/libs.ts';
import { addLintContext, startRun, withAst } from '../_shared/ts.ts';

const LAYERS: WebLayer[] = ['ui', 'feature', 'data-access', 'domain'];

export default async (input: Input) => {
  const run = startRun();
  const context = assertDashed(input.context, 'context');
  const original = await readRequired(
    TSCONFIG_BASE,
    'the aliases are registered in the workspace tsconfig',
  );
  let tsconfig = original;
  await readRequired(
    ESLINT_CONFIG,
    'the context is registered in the lint boundary list',
  );

  // Deliberately fail-closed: a lib that exists is never regenerated over.
  for (const layer of LAYERS) {
    const dir = `libs/web/${context}/${layer}`;
    const files = webLibFiles({
      dir,
      name: `web-${context}-${layer}`,
      ...(layer === 'domain' ? {} : { prefix: context.replace(/-/g, '') }),
      tags: ['scope:web', `context:${context}`, `type:${layer}`],
      layer,
    });
    for (const [path, template] of Object.entries(files))
      createFile(path, template);
    tsconfig = addTsPath(
      tsconfig,
      `${SCOPE}/web-${context}-${layer}`,
      `./${dir}/src/index.ts`,
    );
  }
  rewrite(TSCONFIG_BASE, original, tsconfig);
  run.edit(ESLINT_CONFIG, (file) =>
    withAst(file, (ast) => {
      addLintContext(ast, context);
    }),
  );
  await run.flush();
};
