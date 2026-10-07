import type { Input } from './schema.generated.ts';
import {
  ESLINT_CONFIG,
  SCOPE,
  TSCONFIG_BASE,
  addLintContext,
  addTsPath,
  assertDashed,
  createFile,
  writeBuffer,
  type WriteBuffer,
} from '../_shared/lib.ts';
import { webLibFiles, type WebLayer } from '../_shared/libs.ts';

const LAYERS: WebLayer[] = ['ui', 'feature', 'data-access', 'domain'];

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const context = assertDashed(input.context, 'context');
  let tsconfig = await buffer.readRequired(
    TSCONFIG_BASE,
    'the aliases are registered in the workspace tsconfig',
  );
  const lint = await buffer.readRequired(
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
  await buffer.write(TSCONFIG_BASE, tsconfig);
  await buffer.write(ESLINT_CONFIG, addLintContext(lint, context));
  if (!shared) buffer.flush();
};
