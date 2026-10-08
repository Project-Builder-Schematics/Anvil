import type { Input } from './schema.generated.ts';
import {
  assertDashed,
  docsDir,
  readRequired,
  subdomainNames,
} from '../_shared/lib.ts';
import { startRun, type Run } from '../_shared/ts.ts';
import hexSubdomain from '../hex-subdomain/factory.ts';

export default async (input: Input, shared?: Run) => {
  const run = shared ?? startRun();
  const context = assertDashed(input.context, 'context');
  const readme = await readRequired(
    `${docsDir(context)}/README.md`,
    `create the context first: hex-bounded-context --context=${context}`,
  );
  const subdomains = subdomainNames(readme);
  if (subdomains.length === 0)
    throw new Error(
      `${context}/README.md lists no subdomains under "## Subdomains"`,
    );
  for (const slice of subdomains) await hexSubdomain({ context, slice }, run);
  if (!shared) await run.flush();
};
