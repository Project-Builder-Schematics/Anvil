import { describe, expect, it } from 'bun:test';
import { format } from 'prettier';
import hexBoundedContext from '../hex-bounded-context/factory.ts';
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
    expect(tree.get('eslint.config.mjs')).toContain(
      "const contexts = ['ledger', 'catalog', 'shipping'];",
    );
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

  it.each(['ui', 'feature', 'data-access'])(
    'lays out an Angular %s lib: the exact project, the strict template options and nothing else',
    async (layer) => {
      const { tree } = await go();
      const dir = `libs/web/shipping/${layer}`;

      expect(
        [...tree.keys()].filter((path) => path.startsWith(`${dir}/`)).sort(),
      ).toEqual(
        [
          'eslint.config.mjs',
          'project.json',
          'src/index.ts',
          'tsconfig.json',
          'tsconfig.lib.json',
          'tsconfig.spec.json',
        ].map((p) => `${dir}/${p}`),
      );
      expect(JSON.parse(tree.get(`${dir}/project.json`) ?? '')).toEqual({
        name: `web-shipping-${layer}`,
        $schema: '../../../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `${dir}/src`,
        prefix: 'shipping',
        projectType: 'library',
        tags: ['scope:web', 'context:shipping', `type:${layer}`],
      });
      expect(tree.get(`${dir}/tsconfig.json`)).toContain(
        '"strictTemplates": true',
      );
    },
  );

  it('lays out the domain lib as plain TypeScript with its own vitest config', async () => {
    const { tree } = await go();
    const dir = 'libs/web/shipping/domain';

    expect(
      [...tree.keys()].filter((path) => path.startsWith(`${dir}/`)).sort(),
    ).toEqual(
      [
        'eslint.config.mjs',
        'project.json',
        'src/index.ts',
        'tsconfig.json',
        'tsconfig.lib.json',
        'tsconfig.spec.json',
        'vitest.config.mts',
      ].map((p) => `${dir}/${p}`),
    );
    expect(tree.get(`${dir}/vitest.config.mts`)).toContain(
      "name: 'web-shipping-domain'",
    );
    expect(JSON.parse(tree.get(`${dir}/project.json`) ?? '')).toEqual({
      name: 'web-shipping-domain',
      $schema: '../../../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: `${dir}/src`,
      projectType: 'library',
      tags: ['scope:web', 'context:shipping', 'type:domain'],
    });
  });

  it('writes files that prettier leaves alone', async () => {
    const { tree } = await go();
    const off: string[] = [];
    for (const [path, content] of tree) {
      if (!path.startsWith('libs/')) continue;
      if (
        (await format(content, { filepath: path, singleQuote: true })) !==
        content
      )
        off.push(path);
    }

    expect(off).toEqual([]);
  });

  it('excludes from an Angular lib every test file an API lib excludes, and the test setup', async () => {
    const api = await run(
      hexBoundedContext,
      'hex-bounded-context',
      {
        context: 'catalog',
        purpose: 'x',
        subdomain_class: 'core',
        criticality: 'high',
        volatility: 'low',
      },
      workspace,
    );
    const exclude = (tree: ReadonlyMap<string, string>, path: string) =>
      (JSON.parse(tree.get(path) ?? '') as { exclude: string[] }).exclude;

    const angular = exclude(
      (await go()).tree,
      'libs/web/shipping/ui/tsconfig.lib.json',
    );
    const shared = exclude(
      api.tree,
      'libs/api/catalog/tsconfig.lib.json',
    ).filter((pattern) => !pattern.includes('steps'));
    expect(angular.sort()).toEqual([...shared, 'src/test-setup.ts'].sort());
  });
});
