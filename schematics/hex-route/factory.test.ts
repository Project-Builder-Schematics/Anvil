import { describe, expect, it } from 'bun:test';
import {
  after,
  billingSeed,
  DOCS,
  flat,
  invoicingDocs,
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

/** The names a controller imports from @nestjs/common, sorted. */
const nestCommon = (source: string): string[] =>
  /import \{ ([^}]*) \} from '@nestjs\/common'/
    .exec(source)?.[1]
    ?.split(', ')
    .sort() ?? [];

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
    const source = flat(tree.get(controller) ?? '');
    expect(nestCommon(source)).toEqual([
      'Body',
      'Controller',
      'Inject',
      'Post',
      'UseFilters',
    ]);
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
    const source = flat(tree.get(controller) ?? '');
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
    const source = flat(second.tree.get(controller) ?? '');
    expect(nestCommon(source)).toEqual([
      'Body',
      'Controller',
      'Delete',
      'HttpCode',
      'Inject',
      'Param',
      'Post',
      'Query',
      'UseFilters',
    ]);
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

  it('needs the route in the Driving adapters table: docs first', async () => {
    const error = String((await go({ resource: 'payments' })).error);

    expect(error).toContain(
      'POST /payments is not in the Driving adapters table of domain-model.md — add the route to the docs first',
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

  describe('a body with no fields', () => {
    const withModel = async (replace: [string, string][]) => ({
      ...(await prepared()),
      [`${DOCS}/domain-model.md`]: replace.reduce(
        (model, [from, to]) => model.replace(from, to),
        invoicingModel,
      ),
    });

    it('defaults to an empty object, since Express leaves a missing body undefined and the pipe validates it as is', async () => {
      const seed = await withModel([['`{ customerId }`', '`{}`']]);
      const source = flat((await go({}, seed)).tree.get(controller) ?? '');

      expect(source).toContain(
        'const issueInvoiceBody = z.object({}).default({});',
      );
    });

    it('counts the path parameters as the use case command, not as body fields', async () => {
      const seed = await withModel([
        [
          '| `DELETE /invoices/:invoiceId` | `VoidInvoice` | 204 |',
          '| `POST /invoices/:invoiceId/void` | `VoidInvoice` | 200 |',
        ],
      ]);
      const source =
        (await go({ path: '/:invoiceId/void' }, seed)).tree.get(controller) ??
        '';

      expect(source).toContain(
        'const voidInvoiceBody = z.object({}).default({});',
      );
    });

    it('keeps the plain empty object when the command has fields the body will carry', async () => {
      const source = flat((await go()).tree.get(controller) ?? '');

      expect(source).toContain('const issueInvoiceBody = z.object({});');
    });
  });

  describe('the error filter', () => {
    const filter = `${slice}/infrastructure/http/InvoicingErrorFilter.ts`;
    const rules = (extra: string) =>
      invoicingModel
        .replace(
          /## Business rules[\s\S]*?## Use cases/,
          `## Business rules

| # | Rule | Source |
| --- | --- | --- |
| 1 | No lines: \`LINES_REQUIRED\`. | decided |
| 2 | Unknown customer: \`CUSTOMER_UNKNOWN\`. | decided |
| 3 | No such invoice: \`INVOICE_NOT_FOUND\`. | decided |
| 4 | Already void: \`ALREADY_VOID\`. | decided |
| 5 | Not cited by any route: \`NEVER_ANSWERED\`. | decided |

## Use cases`,
        )
        .replace('| 201 · 422 rule 1 |', `| ${extra} |`);
    const withAnswers = (post: string, del: string) => ({
      ...invoicingDocs,
      [`${DOCS}/domain-model.md`]: rules(post).replace('| 204 |', `| ${del} |`),
    });

    it('maps each code to the status of the Answers cell that cites its rule, ranges and lists included', async () => {
      const seed = await prepared();
      const { tree, error } = await go(
        {},
        {
          ...seed,
          ...withAnswers(
            '201 · 400 · 422 rules 1–2',
            '204 · 404 rule 3 · 409 rule 4',
          ),
        },
      );

      expect(error).toBeUndefined();
      const source = tree.get(filter) ?? '';
      expect(source).toContain('LINES_REQUIRED: 422,');
      expect(source).toContain('CUSTOMER_UNKNOWN: 422,');
      expect(source).toContain('INVOICE_NOT_FOUND: 404,');
      expect(source).toContain('ALREADY_VOID: 409,');
      expect(source).not.toContain('NEVER_ANSWERED');
      expect(source).not.toContain('400');
    });

    it('catches only the slice error class, so global filters still see every other exception', async () => {
      const source = (await go()).tree.get(filter) ?? '';

      expect(source).toContain('@Catch(InvoicingError)');
      expect(source).not.toContain('@Catch()');
      expect(source).toContain('extends BaseExceptionFilter');
    });

    it('types the status map by the error codes, so a typo or a removed code fails to compile', async () => {
      const source = (await go()).tree.get(filter) ?? '';

      expect(source).toContain(
        'const STATUS: Partial<Record<InvoicingErrorCode, number>> = {',
      );
      expect(source).toContain(
        "import { InvoicingError, type InvoicingErrorCode } from '../../domain/errors';",
      );
    });

    it('logs a domain error no route maps and still answers 500', async () => {
      const source = (await go()).tree.get(filter) ?? '';

      expect(source).toContain('new Logger(InvoicingErrorFilter.name)');
      expect(source).toContain('this.logger.error(');
      expect(source).toContain('const statusCode = status ?? 500;');
    });

    it('refreshes the status map on a re-run after the docs change, leaving the controller alone', async () => {
      const seed = await prepared();
      const first = await go({}, seed);
      const changed = {
        ...after(seed, first.tree),
        ...withAnswers('201 · 409 rule 1 · 404 rule 2', '204'),
      };

      const { tree, error } = await go({}, changed);

      expect(error).toBeUndefined();
      const source = tree.get(filter) ?? '';
      expect(source).toContain('LINES_REQUIRED: 409,');
      expect(source).toContain('CUSTOMER_UNKNOWN: 404,');
      expect(source).not.toContain('422');
      expect([...tree.keys()]).toEqual([filter]);
    });

    it('drops the statuses the docs no longer cite on a re-run', async () => {
      const seed = await prepared();
      const first = await go(
        {},
        { ...seed, ...withAnswers('201 · 422 rules 1–2', '204') },
      );
      const changed = {
        ...after(seed, first.tree),
        ...withAnswers('201 · 409 rule 1', '204'),
      };

      const { tree, error } = await go({}, changed);

      expect(error).toBeUndefined();
      const source = tree.get(filter) ?? '';
      expect(source).toContain('LINES_REQUIRED: 409,');
      expect(source).not.toContain('CUSTOMER_UNKNOWN');
    });

    it('registers the filter on every controller of the slice, not only the first', async () => {
      const seed = await prepared();
      const first = await go({}, seed);
      const model = invoicingModel.replace(
        '/invoices/:invoiceId',
        '/voids/:invoiceId',
      );
      const second = await go(
        { resource: 'voids', method: 'DELETE', path: '/:invoiceId' },
        { ...after(seed, first.tree), [`${DOCS}/domain-model.md`]: model },
      );

      expect(second.error).toBeUndefined();
      const source = flat(
        second.tree.get(`${slice}/infrastructure/http/voids.controller.ts`) ??
          '',
      );
      expect(source).toContain(
        "import { InvoicingErrorFilter } from './InvoicingErrorFilter';",
      );
      expect(source).toContain(
        "@Controller('voids') @UseFilters(InvoicingErrorFilter) export class",
      );
      expect(second.tree.get(filter)).toBeUndefined();
    });

    it('refuses a slice whose errors file has no error class, pointing at the file', async () => {
      const seed = await prepared();
      seed[`${slice}/domain/errors.ts`] =
        "export const INVOICING_ERROR = {\n  LINES_REQUIRED: 'billing.lines_required',\n  CUSTOMER_UNKNOWN: 'billing.customer_unknown',\n} as const;\n";
      const { tree, error } = await go({}, seed);

      expect(String(error)).toContain(
        'domain/errors.ts defines no InvoicingError class',
      );
      expect([...tree.keys()]).toEqual([]);
    });

    it('registers the filter on the generated controller', async () => {
      const source = flat((await go()).tree.get(controller) ?? '');

      expect(source).toContain(
        "import { InvoicingErrorFilter } from './InvoicingErrorFilter';",
      );
      expect(source).toContain(
        "@Controller('invoices') @UseFilters(InvoicingErrorFilter) export class",
      );
    });

    it('refuses a code two Answers cells map to different statuses', async () => {
      const { tree, error } = await go(
        {},
        {
          ...(await prepared()),
          ...withAnswers('201 · 422 rule 1', '204 · 409 rule 1'),
        },
      );

      expect(String(error)).toContain(
        'LINES_REQUIRED is answered 422 and 409 in the Driving adapters table',
      );
      expect([...tree.keys()]).toEqual([]);
    });

    it('refuses an Answers cell that cites a rule the model does not have', async () => {
      const { error } = await go(
        {},
        {
          ...(await prepared()),
          ...withAnswers('201 · 422 rule 9', '204'),
        },
      );

      expect(String(error)).toContain('rule 9');
    });

    it('is not generated for a context without error codes', async () => {
      const seed = await prepared();
      const model = (seed[`${DOCS}/domain-model.md`] ?? '').replace(
        /\| 1 \|.*\n\| 2 \|.*\n/,
        '',
      );
      seed[`${DOCS}/domain-model.md`] = model.replace(
        '201 · 422 rule 1',
        '201',
      );
      seed[`${LIB}/src/invoicing/domain/errors.ts`] =
        'export const INVOICING_ERROR = {} as const;\n';
      const { tree, error } = await go({}, seed);

      expect(error).toBeUndefined();
      expect(tree.has(filter)).toBe(false);
      expect(tree.get(controller)).not.toContain('UseFilters');
    });
  });

  it('keeps the type modifier of the @nestjs/common imports it sorts', async () => {
    const seed = await prepared();
    const first = await go({}, seed);
    const withType = after(seed, first.tree);
    withType[controller] = (withType[controller] ?? '').replace(
      /import \{([^}]*)\} from '@nestjs\/common'/,
      "import {$1, type ExecutionContext as Ctx } from '@nestjs/common'",
    );

    const { tree, error } = await go(
      { method: 'DELETE', path: '/:invoiceId' },
      withType,
    );

    expect(error).toBeUndefined();
    expect(tree.get(controller)).toContain('type ExecutionContext as Ctx');
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
