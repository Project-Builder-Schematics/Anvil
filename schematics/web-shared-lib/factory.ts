import type { Input } from './schema.generated.ts';
import {
  SCOPE,
  TSCONFIG_BASE,
  addTsPath,
  assertDashed,
  createFile,
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
  const dir = `libs/web/shared/${name}`;
  const tsconfig = await readRequired(
    TSCONFIG_BASE,
    'the alias is registered in the workspace tsconfig',
  );

  // Deliberately fail-closed: a lib that exists is never regenerated over.
  const files = webLibFiles({
    dir,
    name: `web-shared-${name}`,
    prefix: input.prefix,
    tags: ['scope:web', 'context:shared', 'type:ui'],
    layer: 'ui',
  });
  for (const [path, template] of Object.entries(files))
    createFile(path, template);
  rewrite(
    TSCONFIG_BASE,
    tsconfig,
    addTsPath(tsconfig, `${SCOPE}/web-shared-${name}`, `./${dir}/src/index.ts`),
  );
};
