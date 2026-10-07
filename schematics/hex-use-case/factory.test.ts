import { describe, expect, it } from 'bun:test';
import {
  after,
  billingSeed,
  DOCS,
  invoicingModel,
  LIB,
  run,
  without,
} from '../_shared/testing.ts';
import hexDrivenPort from '../hex-driven-port/factory.ts';
import hexSlice from '../hex-slice/factory.ts';
import factory from './factory.ts';

const slice = `${LIB}/src/invoicing`;

const prepared = async (): Promise<Record<string, string>> => {
  let seed = billingSeed();
  seed = after(
    seed,
    (
      await run(
        hexSlice,
        'hex-slice',
        { context: 'billing', slice: 'invoicing' },
        seed,
      )
    ).tree,
  );
  for (const name of ['InvoiceRepository', 'Clock']) {
    seed = after(
      seed,
      (
        await run(
          hexDrivenPort,
          'hex-driven-port',
          { context: 'billing', slice: 'invoicing', name },
          seed,
        )
      ).tree,
    );
  }
  return seed;
};
const go = async (
  over: Record<string, unknown> = {},
  seed?: Record<string, string>,
) =>
  run(
    factory,
    'hex-use-case',
    { context: 'billing', slice: 'invoicing', name: 'IssueInvoice', ...over },
    seed ?? (await prepared()),
  );

describe('hex-use-case', () => {
  it('writes the use case with its ports, token and a factory that is not implemented yet', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    const source = tree.get(`${slice}/application/IssueInvoice.ts`) ?? '';
    expect(source).toContain(
      "import type { Clock } from '../domain/driven-ports/Clock';",
    );
    expect(source).toContain(
      "import type { InvoiceRepository } from '../domain/driven-ports/InvoiceRepository';",
    );
    expect(source).toContain(
      'export type IssueInvoice = (command: IssueInvoiceCommand) => Promise<IssueInvoiceResult>;',
    );
    expect(source).toContain(
      "export const ISSUE_INVOICE = Symbol('IssueInvoice');",
    );
    expect(source).toContain(
      '(invoiceRepository: InvoiceRepository, clock: Clock): IssueInvoice =>',
    );
    expect(source).toContain(
      "Promise.reject(new Error('IssueInvoice is not implemented'))",
    );
    expect(source).not.toContain('@nestjs');
  });

  it('binds the use case with useFactory and the port tokens, and exposes its token', async () => {
    const composition = (await go()).tree.get(`${slice}/composition.ts`) ?? '';

    expect(composition).toContain(
      "import { ISSUE_INVOICE, makeIssueInvoice } from './application/IssueInvoice';",
    );
    expect(composition).toContain(
      '{ provide: ISSUE_INVOICE, useFactory: makeIssueInvoice, inject: [INVOICE_REPOSITORY, CLOCK] }',
    );
    expect(composition).toContain('exports: [ISSUE_INVOICE]');
  });

  it('re-exports the token and the types from the context barrel', async () => {
    const index = (await go()).tree.get(`${LIB}/src/index.ts`) ?? '';

    expect(index).toContain(
      "export { ISSUE_INVOICE } from './invoicing/application/IssueInvoice';",
    );
    expect(index).toContain(
      "export type { IssueInvoice, IssueInvoiceCommand, IssueInvoiceResult } from './invoicing/application/IssueInvoice';",
    );
    expect(index).toContain("export { BillingModule } from './composition';");
  });

  it('writes one pending quickpickle binding per phrase of the feature', async () => {
    const steps =
      (await go()).tree.get(`${slice}/steps/IssueInvoice.steps.ts`) ?? '';

    expect(steps).toContain("import { Given, Then, When } from 'quickpickle';");
    expect(steps).toContain(
      "Given('customer {string} without lines', (_world, arg0: string) => {\n  throw new Error('step not implemented: customer \"acme\" without lines');\n});",
    );
    expect(steps).toContain(
      "Then('the failure is {string}', (_world, arg0: string) => {\n  throw new Error('step not implemented: the failure is \"LINES_REQUIRED\"');\n});",
    );
  });

  it('skips a phrase a sibling steps file already binds', async () => {
    const seed = {
      ...(await prepared()),
      [`${slice}/steps/VoidInvoice.steps.ts`]:
        "Then('the failure is {string}', () => 'skipped');\n",
    };
    const steps =
      (await go({}, seed)).tree.get(`${slice}/steps/IssueInvoice.steps.ts`) ??
      '';

    expect(steps).not.toContain('the failure is {string}');
    expect(steps).toContain('without lines');
  });

  it('skips a phrase bound by a use case of another subdomain, as the lib loads every steps file', async () => {
    const seed = {
      ...(await prepared()),
      'docs/billing/README.md': (
        (await prepared())['docs/billing/README.md'] ?? ''
      ).replace(
        '| [invoicing](invoicing/domain-model.md) | invoices |',
        '| [invoicing](invoicing/domain-model.md) | invoices |\n| [payouts](payouts/domain-model.md) | payouts |',
      ),
      'docs/billing/payouts/domain-model.md':
        '# Payouts\n\n## Use cases\n\n| Use case | Command | Result | Driven ports | Feature |\n| --- | --- | --- | --- | --- |\n| `PayOut` | `{}` | `{}` | | [pay-out.feature](pay-out.feature) |\n',
      [`${LIB}/src/payouts/steps/PayOut.steps.ts`]:
        "Then('the failure is {string}', () => 'skipped');\n",
    };
    const steps =
      (await go({}, seed)).tree.get(`${slice}/steps/IssueInvoice.steps.ts`) ??
      '';

    expect(steps).not.toContain('the failure is {string}');
    expect(steps).toContain('without lines');
  });

  it('throws when the use-case row links a feature the docs do not have, writing nothing', async () => {
    const seed = without(await prepared(), `${DOCS}/issue-invoice.feature`);
    const { tree, error } = await go({}, seed);

    expect(String(error)).toContain(
      `${DOCS}/issue-invoice.feature does not exist`,
    );
    expect([...tree.keys()]).toEqual([]);
  });

  it('refuses a use case with no row in the domain model: docs first', async () => {
    const { tree, error } = await go({ name: 'ArchiveInvoice' });

    expect(String(error)).toContain('add its row to the docs first');
    expect([...tree.keys()]).toEqual([]);
  });

  it('lets a flag only agree with the doc', async () => {
    expect(
      (await go({ driven_ports: 'Clock, InvoiceRepository' })).error,
    ).toBeUndefined();
    expect(String((await go({ driven_ports: 'Clock' })).error)).toContain(
      'lists InvoiceRepository, Clock in domain-model.md, not Clock',
    );
  });

  it('refuses a driven port that has no adapter yet, pointing at hex-driven-port', async () => {
    const model = invoicingModel.replace(
      '`InvoiceRepository`, `Clock` | [issue',
      '`InvoiceRepository`, `Clock`, `LedgerGateway` | [issue',
    );
    const seed = { ...(await prepared()), [`${DOCS}/domain-model.md`]: model };

    expect(String((await go({}, seed)).error)).toContain(
      'run hex-driven-port --name=LedgerGateway first',
    );
  });

  it('wires a use case without ports with an empty inject list', async () => {
    const model = invoicingModel.replace(
      '`InvoiceRepository`, `Clock` | [issue',
      ' | [issue',
    );
    const seed = { ...(await prepared()), [`${DOCS}/domain-model.md`]: model };
    const { tree, error } = await go({}, seed);

    expect(error).toBeUndefined();
    expect(tree.get(`${slice}/application/IssueInvoice.ts`)).toContain(
      'export const makeIssueInvoice =\n  (): IssueInvoice =>',
    );
    expect(tree.get(`${slice}/composition.ts`)).toContain('inject: []');
  });

  it('is idempotent: a use case that exists is left alone', async () => {
    const seed = await prepared();
    const first = await go({}, seed);
    const second = await go({}, after(seed, first.tree));

    expect([...second.tree.keys()]).toEqual([]);
  });

  it('refuses a slice that was not generated, and a name that is not PascalCase', async () => {
    expect(String((await go({}, billingSeed())).error)).toContain(
      'create the slice first: hex-slice',
    );
    expect(String((await go({ name: 'issueInvoice' })).error)).toContain(
      'PascalCase',
    );
  });
});
