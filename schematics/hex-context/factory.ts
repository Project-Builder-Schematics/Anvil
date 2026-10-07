import type { Input } from './schema.generated.ts';
import {
  assertDashed,
  docsDir,
  table,
  writeBuffer,
  type WriteBuffer,
} from '../_shared/lib.ts';
import hexSubdomain from '../hex-subdomain/factory.ts';

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const context = assertDashed(input.context, 'context');
  const readme = await buffer.readRequired(
    `${docsDir(context)}/README.md`,
    `create the context first: hex-bounded-context --context=${context}`,
  );
  const subdomains = table(readme, 'Subdomains').map(
    (r) => /\[([^\]]+)\]/.exec(r[0] ?? '')?.[1] ?? r[0] ?? '',
  );
  if (subdomains.length === 0)
    throw new Error(
      `${context}/README.md lists no subdomains under "## Subdomains"`,
    );
  for (const slice of subdomains)
    await hexSubdomain({ context, slice }, buffer);
  if (!shared) buffer.flush();
};
