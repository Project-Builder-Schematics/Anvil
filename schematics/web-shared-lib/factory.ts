import type { Input } from './schema.generated.ts';
import { create } from '@pbuilder/sdk/commons';
import {
  SCOPE,
  TSCONFIG_BASE,
  addTsPath,
  assertDashed,
  readRequired,
  rewrite,
} from '../_shared/lib.ts';
import { webLibFiles } from '../_shared/libs.ts';

export default async (input: Input) => {
  const name = assertDashed(input.name, 'name');
  if (!/^[a-z]+$/.test(input.prefix))
    throw new Error(
      `prefix "${input.prefix}" must be lowercase letters (e.g. ds)`,
    );
  const layer = input.layer ?? 'ui';
  const dir = `libs/web/shared/${name}`;
  const tsconfig = await readRequired(
    TSCONFIG_BASE,
    'the alias is registered in the workspace tsconfig',
  );

  // Deliberately fail-closed: a lib that exists is never regenerated over.
  const files = webLibFiles({
    dir,
    name: `web-shared-${name}`,
    ...(layer === 'domain' ? {} : { prefix: input.prefix }),
    tags: ['scope:web', 'context:shared', `type:${layer}`],
    layer,
  });
  for (const [path, template] of Object.entries(files))
    create(path, { template, options: {} });
  rewrite(
    TSCONFIG_BASE,
    tsconfig,
    addTsPath(tsconfig, `${SCOPE}/web-shared-${name}`, `./${dir}/src/index.ts`),
  );
};
