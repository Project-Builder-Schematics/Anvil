import { describe, expect, it } from 'bun:test';
import {
  after,
  billingSeed,
  DOCS,
  invoicingModel,
  LIB,
  run,
  throwIfFailed,
} from '../_shared/testing.ts';
import hexDrivenPort from '../hex-driven-port/factory.ts';
import hexSlice from '../hex-slice/factory.ts';
import hexUseCase from '../hex-use-case/factory.ts';
import factory from './factory.ts';

const slice = `${LIB}/src/invoicing`;
const controller = `${slice}/infrastructure/http/invoices.controller.ts`;

const prepared = async (): Promise<Record<string, string>> => {
  let seed = billingSeed();
  const step = async (
    schematic: string,
    f: Parameters<typeof run>[0],
    input: Record<string, unknown>,
  ) => {
    const result = await run(
      f,
      schematic,
      { context: 'billing', slice: 'invoicing', ...input },
      seed,
    );
    throwIfFailed(result);
    seed = after(seed, result.tree);
  };
  await step('hex-slice', hexSlice, {});
  for (const name of ['InvoiceRepository', 'Clock'])
    await step('hex-driven-port', hexDrivenPort, { name });
  for (const name of ['IssueInvoice', 'VoidInvoice'])
    await step('hex-use-case', hexUseCase, { name });
  return seed;
};
const go = async (
  over: Record<string, unknown> = {},
  seed?: Record<string, string>,
) =>
  run(
    factory,
    'hex-route',
    {
      context: 'billing',
      slice: 'invoicing',
      resource: 'invoices',
      method: 'POST',
      ...over,
    },
    seed ?? (await prepared()),
  );

describe('hex-route', () => {
  it('writes a controller that injects the use case by token and validates with Zod schemas', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    const source = tree.get(controller) ?? '';
    expect(source).toContain(
      "import { Body, Controller, Inject, Post } from '@nestjs/common';",
    );
    expect(source).toContain("import { z } from 'zod';");
    expect(source).toContain("} from '../../application/IssueInvoice';");
    expect(source).toContain('const issueInvoiceBody = z.object({});');
    expect(source).toContain("@Controller('invoices')");
    expect(source).toContain('export class InvoicesController');
    expect(source).toContain(
      '@Inject(ISSUE_INVOICE) private readonly issueInvoiceUseCase: IssueInvoice,',
    );
    expect(source).toContain('@Post()');
    expect(source).toContain(
      '@Body({ schema: issueInvoiceBody }) body: z.infer<typeof issueInvoiceBody>',
    );
    expect(source).toContain('return this.issueInvoiceUseCase(body);');
  });

  it("needs no HttpCode for Nest's default status", async () => {
    expect((await go()).tree.get(controller)).not.toContain('HttpCode');
  });

  it('reads the route, the use case and the status from the Driving adapters row', async () => {
    const { tree, error } = await go({ method: 'DELETE', path: '/:invoiceId' });

    expect(error).toBeUndefined();
    const source = tree.get(controller) ?? '';
    expect(source).toContain(
      'const voidInvoiceParams = z.object({ invoiceId: z.string() });',
    );
    expect(source).toContain('const voidInvoiceQuery = z.object({});');
    expect(source).toContain("@Delete(':invoiceId')");
    expect(source).toContain('@HttpCode(204)');
    expect(source).toContain(
      '@Param({ schema: voidInvoiceParams }) params: z.infer<typeof voidInvoiceParams>',
    );
    expect(source).toContain(
      '@Query({ schema: voidInvoiceQuery }) query: z.infer<typeof voidInvoiceQuery>',
    );
    expect(source).toContain(
      'return this.voidInvoiceUseCase({ ...params, ...query });',
    );
  });

  it("registers the controller in the slice module and the context module in the api's AppModule", async () => {
    const { tree } = await go();

    expect(tree.get(`${slice}/composition.ts`)).toContain(
      "import { InvoicesController } from './infrastructure/http/invoices.controller';",
    );
    expect(tree.get(`${slice}/composition.ts`)).toContain(
      'controllers: [InvoicesController]',
    );
    const app = tree.get('apps/api/src/app/app.module.ts') ?? '';
    expect(app).toContain("import { BillingModule } from '@demo/api-billing';");
    expect(app).toContain(
      'ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),',
    );
    expect(app).toContain('BillingModule,');
    expect(app).toContain('controllers: [HealthController]');
  });

  it('adds a second operation to the same controller', async () => {
    const seed = await prepared();
    const first = await go({}, seed);
    const second = await go(
      { method: 'DELETE', path: '/:invoiceId' },
      after(seed, first.tree),
    );

    expect(second.error).toBeUndefined();
    const source = second.tree.get(controller) ?? '';
    expect(source).toContain(
      "import { Body, Controller, Delete, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';",
    );
    expect(source.match(/@Controller\(/g)).toHaveLength(1);
    expect(source).toContain(
      '@Inject(ISSUE_INVOICE) private readonly issueInvoiceUseCase: IssueInvoice,',
    );
    expect(source).toContain(
      '@Inject(VOID_INVOICE) private readonly voidInvoiceUseCase: VoidInvoice,',
    );
    expect(source).toContain('issueInvoice(');
    expect(source).toContain('voidInvoice(');
    expect(second.tree.get(`${slice}/composition.ts`)).toBeUndefined();
  });

  it('is idempotent: an operation that exists is left alone', async () => {
    const seed = await prepared();
    const first = await go({}, seed);
    const second = await go({}, after(seed, first.tree));

    expect([...second.tree.keys()]).toEqual([]);
  });

  it('refuses a second route for a use case the controller already handles', async () => {
    const seed = await prepared();
    const first = await go({}, seed);
    const model = invoicingModel.replace(
      '| `DELETE /invoices/:invoiceId` | `VoidInvoice` | 204 | token |',
      '| `POST /invoices/bulk` | `IssueInvoice` | 201 | token |',
    );
    const next = {
      ...after(seed, first.tree),
      [`${DOCS}/domain-model.md`]: model,
    };

    const { tree, error } = await go({ path: '/bulk' }, next);

    expect(String(error)).toContain(
      'InvoicesController already handles IssueInvoice on another route',
    );
    expect([...tree.keys()]).toEqual([]);
  });

  it('refuses a route another use case of the controller already answers', async () => {
    const seed = await prepared();
    const first = await go({}, seed);
    const model = invoicingModel.replace(
      '| `POST /invoices` | `IssueInvoice` |',
      '| `POST /invoices` | `VoidInvoice` |',
    );
    const next = {
      ...after(seed, first.tree),
      [`${DOCS}/domain-model.md`]: model,
    };

    const { tree, error } = await go({}, next);

    expect(String(error)).toContain('POST /invoices is already answered by');
    expect([...tree.keys()]).toEqual([]);
  });

  it('lets flags only agree with the doc', async () => {
    expect(String((await go({ use_case: 'VoidInvoice' })).error)).toContain(
      'use_case is IssueInvoice in domain-model.md, not VoidInvoice — fix the doc or the flag',
    );
    expect(String((await go({ status: '200' })).error)).toContain(
      'status is 201 in domain-model.md, not 200 — fix the doc or the flag',
    );
  });

  it('needs the route in the doc or the flags to name it', async () => {
    const error = String((await go({ resource: 'payments' })).error);

    expect(error).toContain(
      'no use_case: pass --use_case or add the route to the Driving adapters table',
    );
  });

  it('refuses a use case the barrel does not export, pointing at hex-use-case', async () => {
    const seed = await prepared();
    seed[`${LIB}/src/index.ts`] =
      "export { BillingModule } from './composition';\n";

    expect(String((await go({}, seed)).error)).toContain(
      'does not export ISSUE_INVOICE — run hex-use-case --name=IssueInvoice first',
    );
  });

  it('refuses a workspace whose api has no AppModule, writing nothing', async () => {
    const seed = await prepared();
    delete seed['apps/api/src/app/app.module.ts'];
    const { tree, error } = await go({}, seed);

    expect(String(error)).toContain('app.module.ts not found');
    expect([...tree.keys()]).toEqual([]);
  });

  it('asks for the path when the resource has several rows for the method', async () => {
    const model = invoicingModel.replace(
      '| `DELETE /invoices/:invoiceId` | `VoidInvoice` | 204 | token |',
      '| `POST /invoices/bulk` | `VoidInvoice` | 201 | token |',
    );
    const seed = { ...(await prepared()), [`${DOCS}/domain-model.md`]: model };

    expect(String((await go({}, seed)).error)).toContain(
      'POST /invoices has 2 rows in domain-model.md — pass --path',
    );
  });
});
