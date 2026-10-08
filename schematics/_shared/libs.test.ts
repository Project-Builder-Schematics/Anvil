import { describe, expect, it } from 'bun:test';
import { format } from 'prettier';
import hexBoundedContext from '../hex-bounded-context/factory.ts';
import { webLibFiles } from './libs.ts';
import { run, workspace } from './testing.ts';

const formatted = async (files: Record<string, string>) => {
  const off: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.md') || path.endsWith('.gitkeep')) continue;
    if (
      (await format(content, { filepath: path, singleQuote: true })) !== content
    )
      off.push(path);
  }
  return off;
};

const parse = (text: string) =>
  JSON.parse(text) as { exclude: string[]; include: string[] };

describe('webLibFiles', () => {
  it.each(['ui', 'feature', 'data-access'] as const)(
    'lays out an Angular %s lib with the context tags and selector prefix',
    async (layer) => {
      const files = webLibFiles({
        dir: `libs/web/catalog/${layer}`,
        name: `web-catalog-${layer}`,
        prefix: 'catalog',
        tags: ['scope:web', 'context:catalog', `type:${layer}`],
        layer,
      });
      const at = (path: string) =>
        files[`libs/web/catalog/${layer}/${path}`] ?? '';

      expect(Object.keys(files).sort()).toEqual(
        [
          'eslint.config.mjs',
          'project.json',
          'src/index.ts',
          'tsconfig.json',
          'tsconfig.lib.json',
          'tsconfig.spec.json',
        ].map((p) => `libs/web/catalog/${layer}/${p}`),
      );
      expect(JSON.parse(at('project.json'))).toEqual({
        name: `web-catalog-${layer}`,
        $schema: '../../../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `libs/web/catalog/${layer}/src`,
        prefix: 'catalog',
        projectType: 'library',
        tags: ['scope:web', 'context:catalog', `type:${layer}`],
      });
      expect(at('eslint.config.mjs')).toContain("prefix: 'catalog'");
      expect(at('tsconfig.json')).toContain('"strictTemplates": true');
      expect(await formatted(files)).toEqual([]);
    },
  );

  it('excludes from an Angular lib every test file an API lib excludes, and the test setup', async () => {
    const angular = webLibFiles({
      dir: 'libs/web/catalog/ui',
      name: 'web-catalog-ui',
      prefix: 'catalog',
      tags: ['scope:web', 'context:catalog', 'type:ui'],
      layer: 'ui',
    });
    const { tree } = await run(
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
    const api = Object.fromEntries(tree);
    const exclude = (files: Record<string, string>, path: string) =>
      parse(files[path] ?? '').exclude;

    const angularExclude = exclude(
      angular,
      'libs/web/catalog/ui/tsconfig.lib.json',
    );
    const apiExclude = exclude(
      api,
      'libs/api/catalog/tsconfig.lib.json',
    ).filter((pattern) => !pattern.includes('steps'));
    expect(angularExclude.sort()).toEqual(
      [...apiExclude, 'src/test-setup.ts'].sort(),
    );
  });

  it('refuses an Angular lib without a selector prefix', () => {
    expect(() =>
      webLibFiles({
        dir: 'libs/web/catalog/ui',
        name: 'web-catalog-ui',
        tags: ['scope:web', 'context:catalog', 'type:ui'],
        layer: 'ui',
      }),
    ).toThrow('selector prefix');
  });

  it('lays out a plain TypeScript domain lib with its own vitest config', async () => {
    const files = webLibFiles({
      dir: 'libs/web/catalog/domain',
      name: 'web-catalog-domain',
      tags: ['scope:web', 'context:catalog', 'type:domain'],
      layer: 'domain',
    });

    expect(Object.keys(files).sort()).toEqual(
      [
        'eslint.config.mjs',
        'project.json',
        'src/index.ts',
        'tsconfig.json',
        'tsconfig.lib.json',
        'tsconfig.spec.json',
        'vitest.config.mts',
      ].map((p) => `libs/web/catalog/domain/${p}`),
    );
    expect(files['libs/web/catalog/domain/vitest.config.mts']).toContain(
      "name: 'web-catalog-domain'",
    );
    expect(
      JSON.parse(files['libs/web/catalog/domain/project.json'] ?? ''),
    ).not.toHaveProperty('prefix');
    expect(await formatted(files)).toEqual([]);
  });
});
