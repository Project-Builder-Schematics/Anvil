import { describe, expect, it } from 'bun:test';
import { format } from 'prettier';
import { table } from '../_shared/lib.ts';
import { run, workspace } from '../_shared/testing.ts';
import factory from './factory.ts';

const input = {
  context: 'tenancy',
  purpose: 'The tenant root: account, settings and membership.',
  subdomain_class: 'supporting',
  criticality: 'high',
  volatility: 'low',
};
const go = (
  over: Record<string, unknown> = {},
  seed: Record<string, string> = workspace,
) => run(factory, 'hex-bounded-context', { ...input, ...over }, seed);

const README = 'docs/tenancy/README.md';
const MODEL = 'docs/tenancy/domain-model.md';

describe('hex-bounded-context: the lib', () => {
  it('creates the whole Nx lib with the context tags', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(
      [...tree.keys()].filter((path) => path.startsWith('libs/')).sort(),
    ).toEqual(
      [
        'COD100.md',
        'eslint.config.mjs',
        'project.json',
        'src/application/.gitkeep',
        'src/composition.ts',
        'src/domain/driven-ports/.gitkeep',
        'src/index.ts',
        'src/infrastructure/.gitkeep',
        'src/steps/index.ts',
        'tsconfig.json',
        'tsconfig.lib.json',
        'tsconfig.spec.json',
        'vitest.config.mts',
      ].map((path) => `libs/api/tenancy/${path}`),
    );
    expect(tree.get('libs/api/tenancy/project.json')).toContain(
      '"tags": ["scope:api", "context:tenancy", "type:domain"]',
    );
    expect(tree.get('libs/api/tenancy/COD100.md')).toBe(
      'The tenant root: account, settings and membership.\n',
    );
    expect(tree.get('libs/api/tenancy/src/composition.ts')).toContain(
      'export class TenancyModule {}',
    );
  });

  it('keeps no ring folders at the root of a context with several subdomains: each slice has its own', async () => {
    const { tree } = await go({ subdomains: 'invoicing,payouts' });

    expect(
      [...tree.keys()].filter((path) => path.endsWith('.gitkeep')),
    ).toEqual([]);
  });

  it('registers the @demo/api-<context> alias in tsconfig.base.json and nowhere else', async () => {
    const { tree } = await go();

    expect(tree.get('tsconfig.base.json')).toContain(
      '"@demo/api-tenancy": ["./libs/api/tenancy/src/index.ts"]',
    );
    expect(tree.has('package.json')).toBe(false);
  });

  it('leaves an alias that is already registered alone', async () => {
    const seed = {
      ...workspace,
      'tsconfig.base.json':
        workspace['tsconfig.base.json']?.replace(
          '"@demo/api-ledger"',
          '"@demo/api-tenancy"',
        ) ?? '',
    };
    const { tree } = await go({}, seed);

    expect(tree.has('tsconfig.base.json')).toBe(false);
  });

  it('adds the context to the lint boundary list', async () => {
    const { tree } = await go();

    expect(tree.get('eslint.config.mjs')).toContain(
      "const contexts = ['ledger', 'catalog', 'tenancy'];",
    );
  });

  it('refuses to overwrite an existing lib, writing nothing', async () => {
    const { tree, error } = await go(
      {},
      { ...workspace, 'libs/api/tenancy/project.json': '{}\n' },
    );

    expect(String(error)).toContain('libs/api/tenancy/project.json');
    expect([...tree.keys()]).toEqual([]);
  });

  it('refuses a workspace without tsconfig.base.json, writing nothing', async () => {
    const { tree, error } = await go(
      {},
      { 'eslint.config.mjs': workspace['eslint.config.mjs'] ?? '' },
    );

    expect(String(error)).toContain('tsconfig.base.json not found');
    expect([...tree.keys()]).toEqual([]);
  });

  it('rejects a context name that is not dash-case', async () => {
    expect(String((await go({ context: 'Tenancy' })).error)).toContain(
      'dash-case',
    );
  });
});

describe('hex-bounded-context: the lib files', () => {
  const lib = async (over: Record<string, unknown> = {}) => {
    const { tree } = await go(over);
    return (path: string) => tree.get(`libs/api/tenancy/${path}`) ?? '';
  };
  const json = (text: string) =>
    JSON.parse(text) as { exclude: string[]; include: string[] };

  it('runs the context features through quickpickle, with no jest mapper anywhere', async () => {
    const config = (await lib())('vitest.config.mts');

    expect(config).toContain("import { quickpickle } from 'quickpickle';");
    expect(config).toContain('quickpickle()');
    expect(config).toContain("'../../../docs/tenancy/**/*.feature'");
    expect(config).toContain("setupFiles: ['./src/steps/index.ts']");
    expect(config).toContain("name: 'api-tenancy'");
    expect(config).toContain(
      "cacheDir: '../../../node_modules/.vite/libs/api/tenancy'",
    );
    expect(config).not.toContain('moduleNameMapper');
  });

  it('gates only domain and application coverage, never steps or adapters', async () => {
    expect((await lib())('vitest.config.mts')).toContain(
      "include: ['src/**/{domain,application}/**/*.ts']",
    );
  });

  it('loads the hand-written world of the steps before the steps, even when they only import its type', async () => {
    expect((await lib())('src/steps/index.ts')).toContain(
      "['./world.ts', './*.steps.ts', '../*/steps/*.steps.ts']",
    );
  });

  it('keeps step files out of the lib project and in the spec project', async () => {
    const at = await lib();

    expect(json(at('tsconfig.lib.json')).exclude).toContain(
      'src/**/steps/*.ts',
    );
    expect(json(at('tsconfig.spec.json')).include).toContain(
      'src/**/steps/*.ts',
    );
  });

  it('exposes the context as a Nest module through the barrel', async () => {
    const at = await lib();

    expect(at('src/composition.ts')).toBe(
      "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class TenancyModule {}\n",
    );
    expect(at('src/index.ts')).toBe(
      "export { TenancyModule } from './composition';\n",
    );
  });

  it('writes a purpose that holds the template delimiter as it is', async () => {
    const { tree } = await go({ purpose: 'Uses {= as is, then {= again.' });

    expect(tree.get('libs/api/tenancy/COD100.md')).toBe(
      'Uses {= as is, then {= again.\n',
    );
    expect(tree.get('docs/tenancy/README.md')).toContain(
      'Uses {= as is, then {= again.',
    );
  });

  it.each(['{}', '["a"]', '{"a": 1}'])(
    'refuses the purpose %s: it reads as JSON, which the engine decodes before it prints',
    async (purpose) => {
      const { tree, error } = await go({ purpose });

      expect(String(error)).toContain('reads as JSON');
      expect([...tree.keys()]).toEqual([]);
    },
  );

  it('names the project and its source root after the lib', async () => {
    expect(JSON.parse((await lib())('project.json'))).toEqual({
      name: 'api-tenancy',
      $schema: '../../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: 'libs/api/tenancy/src',
      projectType: 'library',
      tags: ['scope:api', 'context:tenancy', 'type:domain'],
    });
  });

  it('writes files that prettier leaves alone', async () => {
    const { tree } = await go({ subdomains: '' });
    const off: string[] = [];
    for (const [path, content] of tree) {
      if (!path.startsWith('libs/') || /\.(md|gitkeep)$/.test(path)) continue;
      if (
        (await format(content, { filepath: path, singleQuote: true })) !==
        content
      )
        off.push(path);
    }

    expect(off).toEqual([]);
  });
});

describe('hex-bounded-context: the docs', () => {
  it('writes the README with the purpose and the three classification axes', async () => {
    const readme = (await go()).tree.get(README) ?? '';

    expect(
      readme.startsWith(
        '# Tenancy\n\nThe tenant root: account, settings and membership.\n',
      ),
    ).toBe(true);
    expect(readme).toContain('| Subdomain class | supporting |');
    expect(readme).toContain('| Criticality | high |');
    expect(readme).toContain('| Volatility | low |');
    expect(readme).toContain(
      '## Context map\n\nThe contexts this one depends on',
    );
    expect(readme).toContain(
      '| Depends on | Relationship |\n| --- | --- |\n\n',
    );
    expect(readme).not.toContain('| catalog |');
  });

  it.each([
    ['core', 'low', 'strict'],
    ['generic', 'high', 'strict'],
    ['supporting', 'medium', 'standard'],
    ['generic', 'low', 'standard'],
  ])(
    'class %s + criticality %s gives the %s architecture level',
    async (subdomain_class, criticality, level) => {
      const readme =
        (await go({ subdomain_class, criticality })).tree.get(README) ?? '';

      expect(readme).toContain(`| Architecture level | ${level} |`);
      expect(readme).toContain(`## Architecture level: ${level}`);
    },
  );

  describe('context_map', () => {
    it('writes each relation to the docs and to the lint boundaries', async () => {
      const { tree, error } = await go(
        { context_map: 'catalog:customer-supplier, ledger:acl' },
        {
          ...workspace,
          'tsconfig.base.json': (workspace['tsconfig.base.json'] ?? '').replace(
            '"paths": {',
            '"paths": {\n      "@demo/api-catalog": ["./libs/api/catalog/src/index.ts"],',
          ),
        },
      );

      expect(error).toBeUndefined();
      expect(tree.get(README)).toContain(
        '| Depends on | Relationship |\n| --- | --- |\n| catalog | customer-supplier |\n| ledger | acl |\n',
      );
      expect(tree.get(README)).toContain(
        'Relationship is `customer-supplier`, `conformist` or `acl`.',
      );
      expect(tree.get('eslint.config.mjs')).toContain(
        "const contextRelations = [\n  ['tenancy', 'catalog'],\n  ['tenancy', 'ledger'],\n];",
      );
    });

    it('refuses a context that is not registered, writing nothing', async () => {
      const { tree, error } = await go({ context_map: 'billing:conformist' });

      expect(String(error)).toContain('billing is not a registered context');
      expect([...tree.keys()]).toEqual([]);
    });

    it('refuses a relationship that is not a known type', async () => {
      expect(
        String((await go({ context_map: 'catalog:friends' })).error),
      ).toContain('customer-supplier, conformist, acl');
    });

    it('refuses an entry that is not <context>:<relationship>', async () => {
      expect(
        String((await go({ context_map: 'downstream of catalog' })).error),
      ).toContain('<context>:<relationship>');
    });

    it('refuses the same context listed twice', async () => {
      expect(
        String(
          (await go({ context_map: 'ledger:acl, ledger:conformist' })).error,
        ),
      ).toContain('ledger is listed twice');
    });

    it('refuses a relation a classified README does not declare, writing nothing', async () => {
      const { tree, error } = await go(
        { context_map: 'ledger:acl' },
        { ...workspace, [README]: '# Tenancy\n\n## Classification\n\nhere\n' },
      );

      expect(String(error)).toContain(
        'ledger is not in the Context map of docs/tenancy/README.md',
      );
      expect([...tree.keys()]).toEqual([]);
    });

    describe('with a README that already declares its map', () => {
      const declared = `# Tenancy\n\n## Classification\n\nhere\n\n## Subdomains\n\n| Subdomain | Responsibility |\n| --- | --- |\n| [tenancy](domain-model.md) | |\n\n## Context map\n\n| Depends on | Relationship |\n| --- | --- |\n| ledger | acl |\n`;
      const seed = { ...workspace, [README]: declared };

      it('declares the lint edge for a relation the README lists, leaving the README alone', async () => {
        const { tree, error } = await go({ context_map: 'ledger:acl' }, seed);

        expect(error).toBeUndefined();
        expect(tree.has(README)).toBe(false);
        expect(tree.get('eslint.config.mjs')).toContain(
          "['tenancy', 'ledger']",
        );
      });

      it('declares the lint edges the README lists even when the flag is omitted', async () => {
        const { tree } = await go({}, seed);

        expect(tree.get('eslint.config.mjs')).toContain(
          "['tenancy', 'ledger']",
        );
      });
    });

    it('refuses a context that depends on itself', async () => {
      expect(
        String((await go({ context_map: 'tenancy:conformist' })).error),
      ).toContain('cannot depend on itself');
    });
  });

  it('starts a glossary and, for a single subdomain, keeps the domain model inline', async () => {
    const { tree } = await go();

    expect(tree.get('docs/tenancy/glossary.md')).toStartWith(
      '# Tenancy — glossary\n',
    );
    expect(tree.get(README)).toContain('| [tenancy](domain-model.md) |');
    expect(tree.get(MODEL)).toStartWith('# Tenancy — domain model\n');
    expect(tree.get('docs/tenancy/flows.md')).toStartWith(
      '# Tenancy — flows\n\nSequence diagrams for [tenancy](domain-model.md).',
    );
    expect(tree.has('docs/tenancy/tenancy/domain-model.md')).toBe(false);
  });

  it('writes a domain model with exactly the four tables the generators read', async () => {
    const model = (await go()).tree.get(MODEL) ?? '';

    for (const section of [
      '## Aggregates',
      '## Entities',
      '## Value objects',
      '## Business rules',
      '## Use cases',
      '## Driven ports',
      '## Driving adapters',
    ]) {
      expect(model).toContain(section);
    }
    expect(model).toContain('| # | Rule | Source |');
    expect(model).toContain(
      '| Use case | Command | Result | Driven ports | Feature |',
    );
    expect(model).toContain('| Port | Answers | Adapter today | Contract |');
    expect(model).toContain('| Route | Use case | Answers | Caller |');
    expect(model).not.toMatch(/legacy|Bruno|switchTo|Knex/i);
  });

  it('gives each subdomain its own folder, glossary and flows when the context has several', async () => {
    const { tree } = await go({ subdomains: 'invoicing, payouts' });

    expect(tree.get(README)).toContain(
      '| [invoicing](invoicing/domain-model.md) |',
    );
    expect(tree.get('docs/tenancy/payouts/domain-model.md')).toContain(
      '# Payouts — domain model',
    );
    expect(tree.get('docs/tenancy/payouts/glossary.md')).toStartWith(
      '# Tenancy / payouts — glossary\n',
    );
    expect(tree.get('docs/tenancy/payouts/flows.md')).toStartWith(
      '# Payouts — flows\n',
    );
    expect(tree.get('docs/tenancy/glossary.md')).toContain(
      '## Subdomains\n\n- [invoicing](invoicing/glossary.md)\n- [payouts](payouts/glossary.md)\n',
    );
    expect(tree.has(MODEL)).toBe(false);
  });

  it('rejects a subdomain name that is not dash-case', async () => {
    expect(String((await go({ subdomains: 'Feedback' })).error)).toContain(
      'dash-case',
    );
  });

  describe('classification_status', () => {
    it('forces the strict level and marks every value as assumed', async () => {
      const readme =
        (
          await go({
            classification_status: 'assumed',
            subdomain_class: 'generic',
            criticality: 'low',
          })
        ).tree.get(README) ?? '';

      expect(readme).toContain('| Subdomain class | generic (assumed) |');
      expect(readme).toContain('| Architecture level | strict |');
      expect(readme).toContain(
        'The classification is an assumption until the person confirms it; the strict level applies meanwhile.',
      );
    });

    it('writes the same output when confirmed as when omitted', async () => {
      expect(await go({ classification_status: 'confirmed' })).toEqual(
        await go(),
      );
    });
  });

  it('classifies an existing README by appending, never overwriting it, and keeps an existing glossary', async () => {
    const existing = '# Tenancy\n\nThe tenant root.\n';
    const { tree, error } = await go(
      {},
      {
        ...workspace,
        [README]: existing,
        'docs/tenancy/glossary.md': '# kept\n',
      },
    );

    expect(error).toBeUndefined();
    expect(tree.get(README)?.startsWith(existing)).toBe(true);
    expect(tree.get(README)).toContain('## Classification');
    expect(tree.has('docs/tenancy/glossary.md')).toBe(false);
  });

  it('adds the Subdomains table hex-context and hex-subdomain parse to a README that has none, classified or not', async () => {
    for (const existing of [
      '# Tenancy\n\nThe tenant root.\n',
      '# Tenancy\n\n## Classification\n\nalready here\n',
    ]) {
      const { tree } = await go({}, { ...workspace, [README]: existing });

      const readme = tree.get(README) ?? '';
      expect(readme.startsWith(existing)).toBe(true);
      expect(readme.match(/^## Subdomains$/gm)).toHaveLength(1);
      expect(table(readme, 'Subdomains')).toEqual([
        ['[tenancy](domain-model.md)', ''],
      ]);
    }
  });

  it('lists every subdomain in the table it adds to an existing README', async () => {
    const { tree } = await go(
      { subdomains: 'invoicing,payouts' },
      { ...workspace, [README]: '# Tenancy\n' },
    );

    expect(
      table(tree.get(README) ?? '', 'Subdomains').map(([first]) => first),
    ).toEqual([
      '[invoicing](invoicing/domain-model.md)',
      '[payouts](payouts/domain-model.md)',
    ]);
  });

  it('leaves an already classified README untouched', async () => {
    const { tree } = await go(
      {},
      {
        ...workspace,
        [README]:
          '# Tenancy\n\n## Classification\n\nalready here\n\n## Subdomains\n\n| Subdomain | Responsibility |\n| --- | --- |\n| [tenancy](domain-model.md) | the root |\n',
      },
    );

    expect(tree.has(README)).toBe(false);
  });
});
