import { describe, expect, it } from 'bun:test';
import { run, workspace } from '../_shared/testing.ts';
import factory from './factory.ts';

const go = (
  over: Record<string, unknown> = {},
  seed: Record<string, string> = workspace,
) => run(factory, 'web-context', { context: 'shipping', ...over }, seed);

const LAYERS = ['ui', 'feature', 'data-access', 'domain'];

describe('web-context', () => {
  it('creates the four layer libs under libs/web/<context>', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    for (const layer of LAYERS) {
      expect(tree.has(`libs/web/shipping/${layer}/project.json`)).toBe(true);
      expect(tree.get(`libs/web/shipping/${layer}/src/index.ts`)).toBe(
        'export {};\n',
      );
    }
  });

  it('tags each lib with its context and layer, and gives the Angular libs the context as selector prefix', async () => {
    const { tree } = await go();

    expect(tree.get('libs/web/shipping/ui/project.json')).toContain(
      '"tags": ["scope:web", "context:shipping", "type:ui"]',
    );
    expect(tree.get('libs/web/shipping/data-access/project.json')).toContain(
      '"name": "web-shipping-data-access"',
    );
    expect(tree.get('libs/web/shipping/feature/project.json')).toContain(
      '"prefix": "shipping"',
    );
    expect(tree.get('libs/web/shipping/domain/project.json')).not.toContain(
      '"prefix"',
    );
    expect(tree.get('libs/web/shipping/ui/eslint.config.mjs')).toContain(
      "prefix: 'shipping'",
    );
  });

  it('drops the dashes of a dashed context from the selector prefix, which must be letters only', async () => {
    const { tree } = await go({ context: 'order-items' });

    expect(tree.get('libs/web/order-items/ui/project.json')).toContain(
      '"prefix": "orderitems"',
    );
    expect(
      tree.get('libs/web/order-items/feature/eslint.config.mjs'),
    ).toContain("prefix: 'orderitems'");
    expect(tree.get('libs/web/order-items/ui/project.json')).toContain(
      '"name": "web-order-items-ui"',
    );
  });

  it('registers one alias per layer in tsconfig.base.json and the context in the lint list', async () => {
    const { tree } = await go();
    const base = tree.get('tsconfig.base.json') ?? '';

    for (const layer of LAYERS)
      expect(base).toContain(`"@demo/web-shipping-${layer}": `);
    expect(base).toContain('"./libs/web/shipping/data-access/src/index.ts"');
    expect(tree.get('eslint.config.mjs')).toContain("  'shipping',\n];");
  });

  it('leaves a context that the api already registered in the lint list alone', async () => {
    const { tree } = await go({ context: 'catalog' });

    expect(tree.has('eslint.config.mjs')).toBe(false);
  });

  it('refuses when any lib exists, writing nothing', async () => {
    const { tree, error } = await go(
      {},
      { ...workspace, 'libs/web/shipping/domain/project.json': '{}\n' },
    );

    expect(String(error)).toContain('libs/web/shipping/domain/project.json');
    expect([...tree.keys()]).toEqual([]);
  });

  it('rejects a context name that is not dash-case', async () => {
    expect(String((await go({ context: 'Shipping' })).error)).toContain(
      'dash-case',
    );
  });
});
