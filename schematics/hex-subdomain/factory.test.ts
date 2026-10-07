import { describe, expect, it } from 'bun:test';
import {
  after,
  billingSeed,
  DOCS,
  invoicingModel,
  LIB,
  run,
  voidFeature,
} from '../_shared/testing.ts';
import factory from './factory.ts';

const slice = `${LIB}/src/invoicing`;
const go = (over: Record<string, unknown> = {}, seed = billingSeed()) =>
  run(
    factory,
    'hex-subdomain',
    { context: 'billing', slice: 'invoicing', ...over },
    seed,
  );

describe('hex-subdomain', () => {
  it('generates the slice, its ports, use cases and routes from the domain model', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(
      [...tree.keys()].filter((path) => path.startsWith(`${slice}/`)).sort(),
    ).toEqual(
      [
        'application/.gitkeep',
        'application/IssueInvoice.ts',
        'application/VoidInvoice.ts',
        'composition.ts',
        'domain/driven-ports/.gitkeep',
        'domain/driven-ports/Clock.ts',
        'domain/driven-ports/InvoiceRepository.ts',
        'domain/driven-ports/LedgerGateway.ts',
        'domain/errors.ts',
        'infrastructure/.gitkeep',
        'infrastructure/LedgerLedgerGateway.ts',
        'infrastructure/MemoryClock.ts',
        'infrastructure/MemoryInvoiceRepository.ts',
        'infrastructure/http/InvoicingErrorFilter.ts',
        'infrastructure/http/invoices.controller.ts',
        'steps/IssueInvoice.steps.ts',
        'steps/VoidInvoice.steps.ts',
      ].map((path) => `${slice}/${path}`),
    );
  });

  it('wires every row into one module and one barrel', async () => {
    const { tree } = await go();
    const composition = tree.get(`${slice}/composition.ts`) ?? '';
    const index = tree.get(`${LIB}/src/index.ts`) ?? '';

    for (const token of [
      'INVOICE_REPOSITORY',
      'CLOCK',
      'LEDGER_GATEWAY',
      'ISSUE_INVOICE',
      'VOID_INVOICE',
    ])
      expect(composition).toContain(`provide: ${token}`);
    expect(composition).toContain('controllers: [InvoicesController]');
    expect(index).toContain(
      "export { ISSUE_INVOICE } from './invoicing/application/IssueInvoice';",
    );
    expect(index).toContain(
      "export { VOID_INVOICE } from './invoicing/application/VoidInvoice';",
    );
    expect(tree.get('apps/api/src/app/app.module.ts')).toContain(
      'BillingModule',
    );
  });

  it('puts both routes of the resource in one controller', async () => {
    const source =
      (await go()).tree.get(
        `${slice}/infrastructure/http/invoices.controller.ts`,
      ) ?? '';

    expect(source).toContain('issueInvoice(');
    expect(source).toContain('voidInvoice(');
  });

  it('names the row that cannot be generated, writing nothing', async () => {
    const model = invoicingModel.replace(
      '`POST /invoices` | `IssueInvoice`',
      '`POST /invoices` | `Ghost`',
    );
    const { tree, error } = await go(
      {},
      billingSeed({ [`${DOCS}/domain-model.md`]: model }),
    );

    expect(String(error)).toContain('route POST invoices: ');
    expect([...tree.keys()]).toEqual([]);
  });

  it('rejects a Driving adapters row that is not METHOD /resource', async () => {
    const model = invoicingModel.replace('`POST /invoices`', '`POST invoices`');

    expect(
      String(
        (await go({}, billingSeed({ [`${DOCS}/domain-model.md`]: model })))
          .error,
      ),
    ).toContain('expected METHOD /<resource>');
  });

  describe('re-runs', () => {
    const grown = (seed: Record<string, string>) => ({
      ...seed,
      [`${DOCS}/domain-model.md`]: invoicingModel
        .replace(
          '\n## Driven ports',
          '| `ArchiveInvoice` | `{ invoiceId }` | `{ archived }` | `InvoiceRepository` | [archive-invoice.feature](archive-invoice.feature) |\n\n## Driven ports',
        )
        .replace(
          '| `DELETE /invoices/:invoiceId` | `VoidInvoice` | 204 | token |',
          '| `DELETE /invoices/:invoiceId` | `VoidInvoice` | 204 | token |\n| `POST /invoices/:invoiceId/archive` | `ArchiveInvoice` | 200 | token |',
        ),
      [`${DOCS}/archive-invoice.feature`]: voidFeature.replace(
        'Void',
        'Archive',
      ),
    });

    it('writes nothing when the docs are unchanged', async () => {
      const seed = billingSeed();
      const first = await go({}, seed);
      const second = await go({}, after(seed, first.tree));

      expect(second.error).toBeUndefined();
      expect([...second.tree.keys()]).toEqual([]);
    });

    it('generates only the new pieces after a doc change', async () => {
      const seed = billingSeed();
      const first = await go({}, seed);
      const next = grown(after(seed, first.tree));
      const second = await go({}, next);

      expect(second.error).toBeUndefined();
      expect([...second.tree.keys()].sort()).toEqual(
        [
          `${LIB}/src/index.ts`,
          `${slice}/application/ArchiveInvoice.ts`,
          `${slice}/composition.ts`,
          `${slice}/infrastructure/http/invoices.controller.ts`,
          `${slice}/steps/ArchiveInvoice.steps.ts`,
        ].sort(),
      );
      const again = await go({}, after(next, second.tree));
      expect([...again.tree.keys()]).toEqual([]);
    });
  });
});
