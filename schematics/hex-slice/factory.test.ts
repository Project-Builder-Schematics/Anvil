import { describe, expect, it } from 'bun:test';
import { after, billingSeed, LIB, run, without } from '../_shared/testing.ts';
import factory from './factory.ts';

const go = (seed = billingSeed(), over: Record<string, unknown> = {}) =>
  run(
    factory,
    'hex-slice',
    { context: 'billing', slice: 'invoicing', ...over },
    seed,
  );

describe('hex-slice', () => {
  it('writes the slice module and its domain errors under the slice folder', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(tree.get(`${LIB}/src/invoicing/composition.ts`)).toBe(
      "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class InvoicingModule {}\n",
    );
    expect(tree.get(`${LIB}/src/invoicing/domain/errors.ts`)).toBe(
      "export const INVOICING_ERROR = {\n  LINES_REQUIRED: 'billing.lines_required',\n  CUSTOMER_UNKNOWN: 'billing.customer_unknown',\n} as const;\n",
    );
  });

  it('keeps the slice rings, which an empty slice would lose, with a placeholder each', async () => {
    const { tree } = await go();

    for (const ring of [
      'domain/driven-ports',
      'application',
      'infrastructure',
    ]) {
      expect(tree.get(`${LIB}/src/invoicing/${ring}/.gitkeep`)).toBe('');
    }
  });

  it('imports the slice module into the context module and re-exports it', async () => {
    const composition =
      (await go()).tree.get(`${LIB}/src/composition.ts`) ?? '';

    expect(composition).toContain(
      "import { InvoicingModule } from './invoicing/composition';",
    );
    expect(composition).toContain(
      '@Module({\n  imports: [InvoicingModule],\n  exports: [InvoicingModule],\n})',
    );
  });

  it('keeps the module at src/composition.ts for a single-subdomain context', async () => {
    const seed = billingSeed({
      'docs/billing/README.md':
        '# Billing\n\n## Subdomains\n\n| Subdomain | R |\n| --- | --- |\n| [billing](domain-model.md) | x |\n',
      'docs/billing/domain-model.md':
        '# Billing — domain model\n\n## Business rules\n\n| # | Rule | Source |\n| --- | --- | --- |\n',
    });
    delete seed['docs/billing/invoicing/domain-model.md'];
    const { tree, error } = await go(seed, { slice: 'billing' });

    expect(error).toBeUndefined();
    expect([...tree.keys()]).toEqual([`${LIB}/src/domain/errors.ts`]);
    expect(tree.get(`${LIB}/src/domain/errors.ts`)).toBe(
      'export const BILLING_ERROR = {} as const;\n',
    );
  });

  it('is idempotent: a second run writes nothing', async () => {
    const first = await go();
    const second = await go(after(billingSeed(), first.tree));

    expect(second.error).toBeUndefined();
    expect([...second.tree.keys()]).toEqual([]);
  });

  it('refuses a slice whose docs are not written yet, writing nothing', async () => {
    const { tree, error } = await go(billingSeed(), { slice: 'payouts' });

    expect(String(error)).toContain(
      'write the docs first: hex-bounded-context',
    );
    expect([...tree.keys()]).toEqual([]);
  });

  it('refuses a context whose lib does not exist', async () => {
    const seed = without(billingSeed(), `${LIB}/src/index.ts`);

    expect(String((await go(seed)).error)).toContain(
      'create the context first: hex-bounded-context',
    );
  });

  it('rejects names that are not dash-case', async () => {
    expect(
      String((await go(billingSeed(), { slice: 'Invoicing' })).error),
    ).toContain('dash-case');
  });
});
