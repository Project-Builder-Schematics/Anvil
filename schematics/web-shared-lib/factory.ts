import type { Input } from './schema.generated.ts';
import { scaffold } from '@pbuilder/sdk/commons';
import {
  SCOPE,
  TSCONFIG_BASE,
  addTsPath,
  assertDashed,
  readRequired,
  rewrite,
} from '../_shared/lib.ts';

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
  scaffold({
    from: 'files/angular-lib',
    to: dir,
    options: {
      dir,
      name: `web-shared-${name}`,
      prefix: input.prefix,
      tags: '"scope:web", "context:shared", "type:ui"',
    },
  });
  rewrite(
    TSCONFIG_BASE,
    tsconfig,
    addTsPath(tsconfig, `${SCOPE}/web-shared-${name}`, `./${dir}/src/index.ts`),
  );
};
