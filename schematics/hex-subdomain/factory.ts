import type { Input } from './schema.generated.ts';
import {
  assertDashed,
  parseRoute,
  readRequired,
  resolveSlice,
  table,
} from '../_shared/lib.ts';
import { startRun, type Run } from '../_shared/ts.ts';
import hexDrivenPort from '../hex-driven-port/factory.ts';
import hexRoute from '../hex-route/factory.ts';
import hexSlice from '../hex-slice/factory.ts';
import hexUseCase from '../hex-use-case/factory.ts';

export default async (input: Input, shared?: Run) => {
  const run = shared ?? startRun();
  const context = assertDashed(input.context, 'context');
  const slice = assertDashed(input.slice, 'slice');
  const { docs } = await resolveSlice(context, slice);
  const model = await readRequired(
    `${docs}/domain-model.md`,
    'the subdomain is generated from its domain model',
  );
  const common = { context, slice };

  // The error names the failing row; the run is idempotent, so fix the doc and run again.
  await run.within('slice', () => hexSlice(common, run));
  for (const [name] of table(model, 'Driven ports')) {
    await run.within(`driven port ${name ?? ''}`, () =>
      hexDrivenPort({ ...common, name: name ?? '' }, run),
    );
  }
  for (const [name] of table(model, 'Use cases')) {
    await run.within(`use case ${name ?? ''}`, () =>
      hexUseCase({ ...common, name: name ?? '' }, run),
    );
  }
  for (const [route] of table(model, 'Driving adapters')) {
    const parsed = parseRoute(route ?? '');
    if (!parsed)
      throw new Error(
        `route "${route ?? ''}": expected METHOD /<resource>[/path] in the Driving adapters table`,
      );
    // The runner rewrites an absolute-looking path in an error message, so the label names
    // the row without one: "route GET invoices/seen".
    const label = `route ${parsed.method} ${parsed.resource}${parsed.path === '/' ? '' : parsed.path}`;
    await run.within(label, () =>
      hexRoute(
        {
          ...common,
          resource: parsed.resource,
          method: parsed.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
          path: parsed.path,
        },
        run,
      ),
    );
  }
  if (!shared) await run.flush();
};
