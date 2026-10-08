// Fixtures shared by the schematic tests: a miniature workspace and a hand-written domain model.

import { runFactoryForTest } from '@pbuilder/sdk/testing';
import { format } from 'prettier';
import { apiLibFiles, webLibFiles } from './libs.ts';

const tsconfigBase = `{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@demo/api-ledger": ["./libs/api/ledger/src/index.ts"]
    },
    "noUncheckedIndexedAccess": true
  }
}
`;

const eslintConfig = `const contexts = [
  'ledger',
  'catalog',
];
const contextRelations = [];
const layers = [];
`;

const appModule = `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from '../config';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
`;

export const workspace: Record<string, string> = {
  'tsconfig.base.json': tsconfigBase,
  'eslint.config.mjs': eslintConfig,
  'apps/api/src/app/app.module.ts': appModule,
};

export const LIB = 'libs/api/billing';
export const DOCS = 'docs/billing/invoicing';

/** A hand-written domain model for the nested `invoicing` subdomain of `billing`. */
export const invoicingModel = `# Invoicing — domain model

## Business rules

| # | Rule | Source |
| --- | --- | --- |
| 1 | An invoice without lines is rejected with \`LINES_REQUIRED\`. | decided |
| 2 | An invoice for an unknown customer is rejected with \`CUSTOMER_UNKNOWN\`. | assumed |

## Use cases

| Use case | Command | Result | Driven ports | Feature |
| --- | --- | --- | --- | --- |
| \`IssueInvoice\` | \`{ customerId }\` | \`{ invoiceId }\` | \`InvoiceRepository\`, \`Clock\` | [issue-invoice.feature](issue-invoice.feature) |
| \`VoidInvoice\` | \`{ invoiceId }\` | \`{ voided }\` | \`InvoiceRepository\` | [void-invoice.feature](void-invoice.feature) |

## Driven ports

| Port | Answers | Adapter today | Contract |
| --- | --- | --- | --- |
| \`InvoiceRepository\` | \`byId(id) → Invoice \\| null\` | Memory | stores what it is given |
| \`Clock\` | \`now() → Date\` | Memory | monotonic |
| \`LedgerGateway\` | \`post(entry)\` | @ledger | posts once |

## Driving adapters

| Route | Use case | Answers | Caller |
| --- | --- | --- | --- |
| \`POST /invoices\` | \`IssueInvoice\` | 201 · 422 rule 1 | token |
| \`DELETE /invoices/:invoiceId\` | \`VoidInvoice\` | 204 | token |
`;

const issueFeature = `Feature: Issue invoice

  Rule: an invoice needs lines

    Scenario: no lines
      Given customer "acme" without lines
      When "usr-7" issues the invoice
      Then the failure is "LINES_REQUIRED"
`;

export const voidFeature = `Feature: Void invoice

  Scenario: void
    Given an issued invoice
    When "usr-7" voids the invoice
    Then the failure is "NONE"
`;

export const invoicingDocs: Record<string, string> = {
  'docs/billing/README.md':
    '# Billing\n\n## Subdomains\n\n| Subdomain | Responsibility |\n| --- | --- |\n| [invoicing](invoicing/domain-model.md) | invoices |\n\n## Context map\n\n| Depends on | Relationship |\n| --- | --- |\n| ledger | conformist |\n',
  'docs/billing/glossary.md': '# Billing — glossary\n\n**Invoice.** A bill.\n',
  [`${DOCS}/domain-model.md`]: invoicingModel,
  [`${DOCS}/issue-invoice.feature`]: issueFeature,
  [`${DOCS}/void-invoice.feature`]: voidFeature,
};

/** The billing lib as hex-bounded-context leaves it, plus the hand-written docs. */
export const billingSeed = (
  over: Record<string, string> = {},
): Record<string, string> => ({
  ...workspace,
  ...apiLibFiles('billing', 'Bills customers.', false),
  ...invoicingDocs,
  ...over,
});

/** A source on one line, trailing commas in braces and brackets dropped, so an assertion does not depend on where prettier wrapped it. */
export const flat = (source: string): string =>
  source.replace(/\s+/g, ' ').replace(/, ([}\]])/g, ' $1');

const packageDir = (schematic: string): string =>
  `${import.meta.dir}/../${schematic}`;

/**
 * Runs a factory on a seeded tree; the result's tree holds only what the run committed. The
 * TypeScript files the run edited come back prettier-formatted, as they do after the
 * `prettier --write` step the skill asks for, since the dialect prints with its own quotes.
 */
export const run = async (
  factory: (input: never, shared?: never) => unknown,
  schematic: string,
  input: Record<string, unknown>,
  seed: Record<string, string>,
) => {
  const result = await runFactoryForTest(factory as never, input as never, {
    packageDir: packageDir(schematic),
    seed,
  });
  const tree = new Map(result.tree);
  for (const batch of result.emitted) {
    for (const directive of batch.instructions) {
      if (
        directive.op !== 'modify' ||
        !/\.(ts|mjs)$/.test(directive.modify.path)
      )
        continue;
      const { path } = directive.modify;
      const content = tree.get(path);
      if (content !== undefined)
        tree.set(
          path,
          await format(content, { parser: 'typescript', singleQuote: true }),
        );
    }
  }
  return { ...result, tree };
};

/** The workspace after a run: the seed with the committed writes laid over it. */
export const after = (
  seed: Record<string, string>,
  tree: ReadonlyMap<string, string>,
): Record<string, string> => ({
  ...seed,
  ...Object.fromEntries(tree),
});

export const without = (
  seed: Record<string, string>,
  ...paths: string[]
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(seed).filter(([path]) => !paths.includes(path)),
  );

export const throwIfFailed = (result: { error?: unknown }): void => {
  if (result.error)
    throw result.error instanceof Error
      ? result.error
      : new Error('the run failed');
};

/** Web libs as web-context leaves them, for the ng-* schematics. */
export const webLib = (
  dir: string,
  layer: 'ui' | 'feature' | 'data-access' | 'domain',
  context = 'catalog',
): Record<string, string> =>
  webLibFiles({
    dir,
    name: dir.replace(/^libs\//, '').replace(/\//g, '-'),
    ...(layer === 'domain' ? {} : { prefix: context }),
    tags: ['scope:web', `context:${context}`, `type:${layer}`],
    layer,
  });
