import { describe, expect, it } from 'bun:test';
import { format } from 'prettier';
import { apiLibFiles, webLibFiles } from './libs.ts';

const formatted = async (files: Record<string, string>) => {
  const off: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.md')) continue;
    if (
      (await format(content, { filepath: path, singleQuote: true })) !== content
    )
      off.push(path);
  }
  return off;
};

const parse = (text: string) =>
  JSON.parse(text) as { exclude: string[]; include: string[] };

describe('apiLibFiles', () => {
  const files = apiLibFiles('catalog', 'Owns the product catalog.');
  const at = (path: string) => files[`libs/api/catalog/${path}`] ?? '';

  it('lays out one Nx lib per context with the context tags', () => {
    expect(Object.keys(files).sort()).toEqual(
      [
        'COD100.md',
        'eslint.config.mjs',
        'project.json',
        'src/composition.ts',
        'src/index.ts',
        'src/steps/index.ts',
        'tsconfig.json',
        'tsconfig.lib.json',
        'tsconfig.spec.json',
        'vitest.config.mts',
      ].map((p) => `libs/api/catalog/${p}`),
    );
    expect(JSON.parse(at('project.json'))).toMatchObject({
      name: 'api-catalog',
      sourceRoot: 'libs/api/catalog/src',
      tags: ['scope:api', 'context:catalog', 'type:domain'],
    });
    expect(at('COD100.md')).toBe('Owns the product catalog.\n');
  });

  it('runs the context features through quickpickle, with no jest mapper anywhere', () => {
    const config = at('vitest.config.mts');

    expect(config).toContain("import { quickpickle } from 'quickpickle';");
    expect(config).toContain('quickpickle()');
    expect(config).toContain("'../../../docs/catalog/**/*.feature'");
    expect(config).toContain("setupFiles: ['./src/steps/index.ts']");
    expect(config).toContain("name: 'api-catalog'");
    expect(Object.values(files).join('')).not.toContain('moduleNameMapper');
  });

  it('gates only domain and application coverage, never steps or adapters', () => {
    expect(at('vitest.config.mts')).toContain(
      "include: ['src/**/{domain,application}/**/*.ts']",
    );
  });

  it('keeps step files out of the lib project and in the spec project', () => {
    expect(parse(at('tsconfig.lib.json')).exclude).toContain(
      'src/**/steps/*.ts',
    );
    expect(parse(at('tsconfig.spec.json')).include).toContain(
      'src/**/steps/*.ts',
    );
  });

  it('exposes the context as a Nest module through the barrel', () => {
    expect(at('src/composition.ts')).toBe(
      "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class CatalogModule {}\n",
    );
    expect(at('src/index.ts')).toBe(
      "export { CatalogModule } from './composition';\n",
    );
  });

  it('writes files that prettier leaves alone', async () => {
    expect(await formatted(files)).toEqual([]);
  });
});

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
