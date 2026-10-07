import { describe, expect, it } from 'bun:test';
import {
  after,
  billingSeed,
  DOCS,
  invoicingModel,
  LIB,
  run,
} from '../_shared/testing.ts';
import hexSlice from '../hex-slice/factory.ts';
import factory from './factory.ts';

const slice = `${LIB}/src/invoicing`;
const sliced = async () =>
  after(
    billingSeed(),
    (
      await run(
        hexSlice,
        'hex-slice',
        { context: 'billing', slice: 'invoicing' },
        billingSeed(),
      )
    ).tree,
  );
const go = async (
  over: Record<string, unknown> = {},
  seed?: Record<string, string>,
) =>
  run(
    factory,
    'hex-driven-port',
    {
      context: 'billing',
      slice: 'invoicing',
      name: 'InvoiceRepository',
      ...over,
    },
    seed ?? (await sliced()),
  );

describe('hex-driven-port', () => {
  it('writes the port interface with its token and a memory adapter, read from the doc', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(
      tree.get(`${slice}/domain/driven-ports/InvoiceRepository.ts`),
    ).toContain('export interface InvoiceRepository {}');
    expect(
      tree.get(`${slice}/domain/driven-ports/InvoiceRepository.ts`),
    ).toContain(
      "export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');",
    );
    expect(tree.get(`${slice}/infrastructure/MemoryInvoiceRepository.ts`)).toBe(
      "import { Injectable } from '@nestjs/common';\nimport type { InvoiceRepository } from '../domain/driven-ports/InvoiceRepository';\n\n@Injectable()\nexport class MemoryInvoiceRepository implements InvoiceRepository {}\n",
    );
  });

  it('keeps the framework out of the port and out of everything but the adapter and the module', async () => {
    const { tree } = await go();
    const nest = [...tree]
      .filter(([, content]) => content.includes('@nestjs/'))
      .map(([path]) => path);

    expect(nest.sort()).toEqual([
      `${slice}/composition.ts`,
      `${slice}/infrastructure/MemoryInvoiceRepository.ts`,
    ]);
  });

  it('binds the token to the adapter in the slice module', async () => {
    const composition = (await go()).tree.get(`${slice}/composition.ts`) ?? '';

    expect(composition).toContain(
      "import { INVOICE_REPOSITORY } from './domain/driven-ports/InvoiceRepository';",
    );
    expect(composition).toContain(
      "import { MemoryInvoiceRepository } from './infrastructure/MemoryInvoiceRepository';",
    );
    expect(composition).toContain(
      '  providers: [\n    { provide: INVOICE_REPOSITORY, useClass: MemoryInvoiceRepository },\n  ],',
    );
  });

  it("writes a context adapter that knows only the provider's barrel", async () => {
    const { tree, error } = await go({ name: 'LedgerGateway' });

    expect(error).toBeUndefined();
    const adapter =
      tree.get(`${slice}/infrastructure/LedgerLedgerGateway.ts`) ?? '';
    expect(adapter).toContain(
      "import type * as ledger from '@demo/api-ledger';",
    );
    expect(adapter).toContain('export type LedgerApi = typeof ledger;');
    expect(adapter).toContain(
      'export class LedgerLedgerGateway implements LedgerGateway {}',
    );
    expect(tree.get(`${slice}/composition.ts`)).toContain(
      'useClass: LedgerLedgerGateway',
    );
  });

  it('refuses a provider context that is not registered', async () => {
    const seed = await sliced();
    seed['tsconfig.base.json'] = (seed['tsconfig.base.json'] ?? '').replace(
      '@demo/api-ledger',
      '@demo/api-other',
    );
    const { tree, error } = await go({ name: 'LedgerGateway' }, seed);

    expect(String(error)).toContain('@demo/api-ledger is not registered');
    expect([...tree.keys()]).toEqual([]);
  });

  it('refuses a context adapter for the context itself', async () => {
    const model = invoicingModel.replace('| @ledger |', '| @billing |');
    const seed = { ...(await sliced()), [`${DOCS}/domain-model.md`]: model };

    expect(String((await go({ name: 'LedgerGateway' }, seed)).error)).toContain(
      'cannot be its own provider',
    );
  });

  it('needs a kind when the doc has no row for the port', async () => {
    const error = String((await go({ name: 'Mailer' })).error);

    expect(error).toContain('pass --kind');
  });

  it('takes the kind from the flag when the doc has no row, and a flag may only agree with the doc', async () => {
    expect(
      (await go({ name: 'Mailer', kind: 'memory' })).error,
    ).toBeUndefined();
    expect(
      String((await go({ kind: 'context', provider: 'ledger' })).error),
    ).toContain(
      'InvoiceRepository is Memory in domain-model.md, not @ledger — fix the doc or the flag',
    );
  });

  it('is idempotent: a port that exists is left alone', async () => {
    const first = await go();
    const second = await go({}, after(await sliced(), first.tree));

    expect([...second.tree.keys()]).toEqual([]);
  });

  it('refuses a slice whose composition does not exist, writing nothing', async () => {
    const { tree, error } = await go({}, billingSeed());

    expect(String(error)).toContain('create the slice first: hex-slice');
    expect([...tree.keys()]).toEqual([]);
  });

  it('rejects a port name that is not PascalCase', async () => {
    expect(String((await go({ name: 'invoiceRepository' })).error)).toContain(
      'PascalCase',
    );
  });
});
