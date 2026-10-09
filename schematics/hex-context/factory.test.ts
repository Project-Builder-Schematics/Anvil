import { describe, expect, it } from 'bun:test';
import { billingSeed, LIB, run } from '../_shared/testing.ts';
import factory from './factory.ts';

const go = (seed = billingSeed(), over: Record<string, unknown> = {}) =>
  run(factory, 'hex-context', { context: 'billing', ...over }, seed);

describe('hex-context', () => {
  it('generates every subdomain the README lists', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(tree.has(`${LIB}/src/invoicing/application/IssueInvoice.ts`)).toBe(
      true,
    );
  });

  it('refuses a context whose README is missing, or lists no subdomains', async () => {
    const seed = billingSeed();
    delete seed['docs/billing/README.md'];
    expect(String((await go(seed)).error)).toContain(
      'create the context first: hex-bounded-context',
    );
    expect(
      String(
        (await go(billingSeed({ 'docs/billing/README.md': '# Billing\n' })))
          .error,
      ),
    ).toContain('lists no subdomains');
  });
});
