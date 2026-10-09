// Fixtures shared by the schematic tests: a miniature workspace and a hand-written domain model.

import type { Batch } from '@pbuilder/sdk/testing';
import { format } from 'prettier';
// No public subpath exports these two (sdk 0.3.1), and `runFactoryForTest` cannot render a created file.
import { defineFactory } from '../../node_modules/@pbuilder/sdk/dist/core/context.js';
import { ContractFake } from '../../node_modules/@pbuilder/sdk/dist/testing/contract-fake.js';
import hexBoundedContext from '../hex-bounded-context/factory.ts';
import webContext from '../web-context/factory.ts';
import webSharedLib from '../web-shared-lib/factory.ts';
import { render } from './render.ts';

const tsconfigBase = `{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@anvil/api-ledger": ["./libs/api/ledger/src/index.ts"]
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

/** A source on one line, trailing commas in braces and brackets dropped, so an assertion does not depend on where prettier wrapped it. */
export const flat = (source: string): string =>
  source.replace(/\s+/g, ' ').replace(/, ([}\]])/g, ' $1');

const packageDir = (schematic: string): string =>
  `${import.meta.dir}/../${schematic}`;

/** The batch as the engine applies it: every created file and path rendered from its options. */
const rendered = (batch: Batch): Batch => ({
  ...batch,
  instructions: batch.instructions.map((directive) => {
    if (directive.op !== 'create') return directive;
    const { pathTemplate, template, options } = directive.create;
    const values = (options ?? {}) as Record<string, unknown>;
    return {
      ...directive,
      create: {
        ...directive.create,
        pathTemplate: render(pathTemplate, values),
        template: render(template, values),
      },
    };
  }),
});

/**
 * `runFactoryForTest` with the engine's rendering: a created file holds what its template renders
 * to, for the tree and for every later read of the same run. `emitted` keeps the directives as
 * the factory wrote them. `packageDir` anchors `templateFile`.
 */
export const runFactory = async (
  factory: (input: never) => unknown,
  input: Record<string, unknown>,
  options: { seed?: Record<string, string>; packageDir?: string },
) => {
  const fake = new ContractFake({ seed: options.seed ?? {} });
  const emitted: Batch[] = [];
  const client = {
    emit: (batch: Batch) => {
      emitted.push(batch);
      return fake.emit(rendered(batch));
    },
    read: (path: string) => fake.read(path),
    commit: () => fake.commit(),
    discard: () => fake.discard(),
  };
  const wrapped = defineFactory(
    factory as (input: unknown) => void | Promise<void>,
    options.packageDir === undefined
      ? undefined
      : { packageDir: options.packageDir },
  );
  let error: unknown;
  try {
    await wrapped(input, { client });
  } catch (caught) {
    error = caught;
  }
  return { tree: fake.committedTree(), emitted, error };
};

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
  const result = await runFactory(factory, input, {
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

export const throwIfFailed = (result: { error?: unknown }): void => {
  if (result.error)
    throw result.error instanceof Error
      ? result.error
      : new Error('the run failed');
};

/** The billing lib, a context of several subdomains, as hex-bounded-context writes it. */
const billingLib = await (async () => {
  const { tree, error } = await run(
    hexBoundedContext,
    'hex-bounded-context',
    {
      context: 'billing',
      purpose: 'Bills customers.',
      subdomain_class: 'core',
      criticality: 'high',
      volatility: 'low',
      subdomains: 'invoicing,payouts',
    },
    workspace,
  );
  throwIfFailed({ error });
  return Object.fromEntries(
    [...tree].filter(([path]) => path.startsWith(`${LIB}/`)),
  );
})();

/** The billing lib plus the hand-written docs. */
export const billingSeed = (
  over: Record<string, string> = {},
): Record<string, string> => ({
  ...workspace,
  ...billingLib,
  ...invoicingDocs,
  ...over,
});

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

/** The web libs of a catalog context and of the shared design system, as the schematics write them. */
const webLibs = await (async () => {
  const runs = await Promise.all([
    run(webContext, 'web-context', { context: 'catalog' }, workspace),
    run(
      webSharedLib,
      'web-shared-lib',
      { name: 'design-system', prefix: 'ds' },
      workspace,
    ),
  ]);
  const files = new Map<string, string>();
  for (const { tree, error } of runs) {
    throwIfFailed({ error });
    for (const [path, content] of tree)
      if (path.startsWith('libs/')) files.set(path, content);
  }
  return files;
})();

/** The files of one of those libs, for the ng-* schematics to write into. */
export const webLib = (dir: string): Record<string, string> => {
  const files = [...webLibs].filter(([path]) => path.startsWith(`${dir}/`));
  if (files.length === 0) throw new Error(`no web lib fixture at ${dir}`);
  return Object.fromEntries(files);
};
