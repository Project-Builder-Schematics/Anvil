import { describe, expect, it } from 'bun:test';
import { run, workspace } from '../_shared/testing.ts';
import factory from './factory.ts';

const go = (
  over: Record<string, unknown> = {},
  seed: Record<string, string> = workspace,
) =>
  run(
    factory,
    'web-shared-lib',
    { name: 'design-system', prefix: 'ds', ...over },
    seed,
  );

describe('web-shared-lib', () => {
  it('creates an Angular lib under libs/web/shared tagged for every context', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(
      [...tree.keys()].filter((path) => path.startsWith('libs/')).sort(),
    ).toEqual(
      [
        'eslint.config.mjs',
        'project.json',
        'src/index.ts',
        'tsconfig.json',
        'tsconfig.lib.json',
        'tsconfig.spec.json',
      ].map((p) => `libs/web/shared/design-system/${p}`),
    );
    const project =
      tree.get('libs/web/shared/design-system/project.json') ?? '';
    expect(project).toContain('"name": "web-shared-design-system"');
    expect(project).toContain('"prefix": "ds"');
    expect(project).toContain(
      '"tags": ["scope:web", "context:shared", "type:ui"]',
    );
    expect(
      tree.get('libs/web/shared/design-system/eslint.config.mjs'),
    ).toContain("prefix: 'ds'");
  });

  it('registers the alias and touches no lint list: shared is not a context', async () => {
    const { tree } = await go();

    expect(tree.get('tsconfig.base.json')).toContain(
      '"@anvil/web-shared-design-system": [',
    );
    expect(tree.has('eslint.config.mjs')).toBe(false);
  });

  it('refuses an existing lib, writing nothing', async () => {
    const { tree, error } = await go(
      {},
      { ...workspace, 'libs/web/shared/design-system/project.json': '{}\n' },
    );

    expect(String(error)).toContain(
      'libs/web/shared/design-system/project.json',
    );
    expect([...tree.keys()]).toEqual([]);
  });

  it('rejects names that are not dash-case and prefixes that are not lowercase letters', async () => {
    expect(String((await go({ name: 'DesignSystem' })).error)).toContain(
      'dash-case',
    );
    expect(String((await go({ prefix: 'Ds' })).error)).toContain(
      'lowercase letters',
    );
  });
});
