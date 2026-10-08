import type { Input } from './schema.generated.ts';
import { scaffold } from '@pbuilder/sdk/commons';
import {
  ESLINT_CONFIG,
  SCOPE,
  TSCONFIG_BASE,
  addTsPath,
  assertDashed,
  readRequired,
  rewrite,
} from '../_shared/lib.ts';
import { addLintContext, startRun, withAst } from '../_shared/ts.ts';

const LAYERS = ['ui', 'feature', 'data-access', 'domain'] as const;

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
    scaffold({
      from: layer === 'domain' ? 'files/domain-lib' : 'files/angular-lib',
      to: dir,
      options: {
        dir,
        name: `web-${context}-${layer}`,
        prefix: context.replace(/-/g, ''),
        tags: ['scope:web', `context:${context}`, `type:${layer}`]
          .map((tag) => `"${tag}"`)
          .join(', '),
      },
    });
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
