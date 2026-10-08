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

  it('names the provider namespace of a dashed context as an identifier', async () => {
    const seed = await sliced();
    for (const path of [
      'tsconfig.base.json',
      'docs/billing/README.md',
      `${DOCS}/domain-model.md`,
    ])
      seed[path] = (seed[path] ?? '')
        .replaceAll('api-ledger', 'api-order-items')
        .replaceAll('| ledger |', '| order-items |')
        .replaceAll('@ledger', '@order-items');

    const { tree, error } = await go({ name: 'LedgerGateway' }, seed);

    expect(error).toBeUndefined();
    const adapter =
      tree.get(`${slice}/infrastructure/OrderItemsLedgerGateway.ts`) ?? '';
    expect(adapter).toContain(
      "import type * as orderItems from '@demo/api-order-items';",
    );
    expect(adapter).toContain('export type OrderItemsApi = typeof orderItems;');
  });

  it('refuses a context port named Api, whose adapter would take the name of the provider type', async () => {
    const model = invoicingModel.replace(
      '| `Clock` |',
      '| `Api` | `call()` | @ledger | calls once |\n| `Clock` |',
    );
    const seed = { ...(await sliced()), [`${DOCS}/domain-model.md`]: model };

    expect(String((await go({ name: 'Api' }, seed)).error)).toContain(
      'LedgerApi is the type that adapter exports',
    );
  });

  it('refuses a port whose token another port of the slice already has', async () => {
    const first = await go({ name: 'OrderId', kind: 'memory' });
    const seed = after(await sliced(), first.tree);

    const { tree, error } = await go({ name: 'OrderID', kind: 'memory' }, seed);

    expect(String(error)).toContain(
      'ORDER_ID is already taken by another port',
    );
    expect([...tree.keys()]).toEqual([]);
  });

  it('refuses an adapter file that already exists for another port', async () => {
    const seed = {
      ...(await sliced()),
      [`${slice}/infrastructure/MemoryInvoiceRepository.ts`]: 'export {};\n',
    };

    const { tree, error } = await go({}, seed);

    expect(String(error)).toContain(
      'MemoryInvoiceRepository.ts already exists for another port',
    );
    expect([...tree.keys()]).toEqual([]);
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

  it('declares the relation in the lint boundaries, only for a context adapter', async () => {
    const first = await go({ name: 'LedgerGateway' });

    expect(first.tree.get('eslint.config.mjs')).toContain(
      "const contextRelations = [['billing', 'ledger']];",
    );
    expect((await go()).tree.has('eslint.config.mjs')).toBe(false);
  });

  it('leaves the lint boundaries alone when the edge is already there', async () => {
    const seed = await sliced();
    seed['eslint.config.mjs'] = (seed['eslint.config.mjs'] ?? '').replace(
      'contextRelations = []',
      "contextRelations = [\n  ['billing', 'ledger'],\n]",
    );

    const { tree, error } = await go({ name: 'LedgerGateway' }, seed);

    expect(error).toBeUndefined();
    expect(tree.has('eslint.config.mjs')).toBe(false);
  });

  it('refuses a provider the context map of the docs does not declare, writing nothing', async () => {
    const seed = await sliced();
    seed['docs/billing/README.md'] = (
      seed['docs/billing/README.md'] ?? ''
    ).replace('| ledger | conformist |\n', '');

    const { tree, error } = await go({ name: 'LedgerGateway' }, seed);

    expect(String(error)).toContain(
      'ledger is not in the Context map of docs/billing/README.md — declare the relation there first',
    );
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

  describe('re-runs over a generated port', () => {
    const adapterPath = `${slice}/infrastructure/MemoryInvoiceRepository.ts`;
    const generated = async (name = 'InvoiceRepository') => {
      const first = await go({ name });
      return after(await sliced(), first.tree);
    };

    it('leaves an adapter alone when it was implemented by hand for the same port', async () => {
      const seed = await generated();
      const edited = {
        ...seed,
        [adapterPath]: `${seed[adapterPath] ?? ''}// implemented\n`,
      };

      const { tree, error } = await go({}, edited);

      expect(error).toBeUndefined();
      expect([...tree.keys()]).toEqual([]);
    });

    it('refuses an adapter file that implements another port', async () => {
      const seed = await generated();
      const foreign = {
        ...seed,
        [adapterPath]: (seed[adapterPath] ?? '').replaceAll(
          'InvoiceRepository',
          'Other',
        ),
      };

      const { tree, error } = await go({}, foreign);

      expect(String(error)).toContain('already exists for another port');
      expect([...tree.keys()]).toEqual([]);
    });

    it('refuses a doc that now answers the port with another adapter', async () => {
      const seed = await generated();
      const changed = {
        ...seed,
        [`${DOCS}/domain-model.md`]: invoicingModel.replace(
          '| `InvoiceRepository` | `byId(id) → Invoice \\| null` | Memory |',
          '| `InvoiceRepository` | `byId(id) → Invoice \\| null` | @ledger |',
        ),
      };

      const { tree, error } = await go({}, changed);

      expect(String(error)).toContain('is already provided by');
      expect([...tree.keys()]).toEqual([]);
    });

    it('refuses a token another port of the slice has already taken', async () => {
      const seed = await generated();
      const composition = `${slice}/composition.ts`;
      const taken = {
        ...seed,
        [composition]: (seed[composition] ?? '').replace(
          "'./domain/driven-ports/InvoiceRepository'",
          "'./domain/driven-ports/Other'",
        ),
      };

      const { tree, error } = await go({}, taken);

      expect(String(error)).toContain('is already taken by another port');
      expect([...tree.keys()]).toEqual([]);
    });
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
