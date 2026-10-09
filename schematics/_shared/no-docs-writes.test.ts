import { describe, expect, it } from 'bun:test';
import hexBoundedContext from '../hex-bounded-context/factory.ts';
import hexContext from '../hex-context/factory.ts';
import hexDrivenPort from '../hex-driven-port/factory.ts';
import hexRoute from '../hex-route/factory.ts';
import hexSlice from '../hex-slice/factory.ts';
import hexSubdomain from '../hex-subdomain/factory.ts';
import hexUseCase from '../hex-use-case/factory.ts';
import {
  after,
  billingSeed,
  run,
  workspace,
  throwIfFailed,
} from './testing.ts';

// Docs are the contract and a human writes them: a generator that writes under docs/ makes
// the code the source of its own specification. Every factory runs on a tree whose docs are
// already written by hand, and may touch nothing there.

const at = { context: 'billing', slice: 'invoicing' };

const step = async (
  seed: Record<string, string>,
  f: Parameters<typeof run>[0],
  schematic: string,
  input: Record<string, unknown>,
) => {
  const result = await run(f, schematic, input, seed);
  throwIfFailed(result);
  return after(seed, result.tree);
};

const base = billingSeed();
const sliced = () => step(base, hexSlice, 'hex-slice', at);
const ported = async () => {
  let seed = await sliced();
  for (const name of ['InvoiceRepository', 'Clock'])
    seed = await step(seed, hexDrivenPort, 'hex-driven-port', { ...at, name });
  return seed;
};
const used = async () => {
  let seed = await ported();
  for (const name of ['IssueInvoice', 'VoidInvoice'])
    seed = await step(seed, hexUseCase, 'hex-use-case', { ...at, name });
  return seed;
};

const cases: Array<{
  name: string;
  schematic: string;
  factory: Parameters<typeof run>[0];
  input: Record<string, unknown>;
  seed: () => Promise<Record<string, string>>;
}> = [
  {
    name: 'hex-slice',
    schematic: 'hex-slice',
    factory: hexSlice,
    input: at,
    seed: () => Promise.resolve(base),
  },
  {
    name: 'hex-driven-port',
    schematic: 'hex-driven-port',
    factory: hexDrivenPort,
    input: { ...at, name: 'InvoiceRepository' },
    seed: sliced,
  },
  {
    name: 'hex-use-case',
    schematic: 'hex-use-case',
    factory: hexUseCase,
    input: { ...at, name: 'IssueInvoice' },
    seed: ported,
  },
  {
    name: 'hex-route',
    schematic: 'hex-route',
    factory: hexRoute,
    input: { ...at, resource: 'invoices', method: 'POST' },
    seed: used,
  },
  {
    name: 'hex-subdomain',
    schematic: 'hex-subdomain',
    factory: hexSubdomain,
    input: at,
    seed: () => Promise.resolve(base),
  },
  {
    name: 'hex-context',
    schematic: 'hex-context',
    factory: hexContext,
    input: { context: 'billing' },
    seed: () => Promise.resolve(base),
  },
];

describe('generators never write docs', () => {
  it.each(cases)(
    '$name writes only code',
    async ({ schematic, factory, input, seed }) => {
      const { tree, error } = await run(
        factory,
        schematic,
        input,
        await seed(),
      );

      expect(error).toBeUndefined();
      expect(
        [...tree.keys()].filter((path) => path.startsWith('docs/')),
      ).toEqual([]);
      expect(tree.size).toBeGreaterThan(0);
    },
  );

  it('hex-bounded-context is the one generator allowed to write docs, and writes only the skeleton files', async () => {
    const { tree, error } = await run(
      hexBoundedContext,
      'hex-bounded-context',
      {
        context: 'tenancy',
        purpose: 'The tenant root.',
        subdomain_class: 'supporting',
        criticality: 'high',
        volatility: 'low',
      },
      workspace,
    );

    expect(error).toBeUndefined();
    expect(
      [...tree.keys()].filter((path) => path.startsWith('docs/')).sort(),
    ).toEqual([
      'docs/tenancy/README.md',
      'docs/tenancy/domain-model.md',
      'docs/tenancy/flows.md',
      'docs/tenancy/glossary.md',
    ]);
  });
});
