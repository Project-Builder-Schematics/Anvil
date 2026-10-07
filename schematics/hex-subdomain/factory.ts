import type { Input } from './schema.generated.ts';
import {
  assertDashed,
  parseRoute,
  resolveSlice,
  table,
  writeBuffer,
  type WriteBuffer,
} from '../_shared/lib.ts';
import hexDrivenPort from '../hex-driven-port/factory.ts';
import hexRoute from '../hex-route/factory.ts';
import hexSlice from '../hex-slice/factory.ts';
import hexUseCase from '../hex-use-case/factory.ts';

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const context = assertDashed(input.context, 'context');
  const slice = assertDashed(input.slice, 'slice');
  const { docs } = await resolveSlice(context, slice, buffer);
  const model = await buffer.readRequired(
    `${docs}/domain-model.md`,
    'the subdomain is generated from its domain model',
  );
  const common = { context, slice };

  // The error names the failing row; the run is idempotent, so fix the doc and run again.
  const step = async (label: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      throw new Error(`${label}: ${(error as Error).message}`);
    }
  };

  await step('slice', () => hexSlice(common, buffer));
  for (const [name] of table(model, 'Driven ports')) {
    await step(`driven port ${name ?? ''}`, () =>
      hexDrivenPort({ ...common, name: name ?? '' }, buffer),
    );
  }
  for (const [name] of table(model, 'Use cases')) {
    await step(`use case ${name ?? ''}`, () =>
      hexUseCase({ ...common, name: name ?? '' }, buffer),
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
    await step(label, () =>
      hexRoute(
        {
          ...common,
          resource: parsed.resource,
          method: parsed.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
          path: parsed.path,
        },
        buffer,
      ),
    );
  }
  if (!shared) buffer.flush();
};
