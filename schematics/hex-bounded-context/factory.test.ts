import { describe, expect, it } from 'bun:test';
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
      "  'catalog',\n  'tenancy',\n];",
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

  describe('tactical', () => {
    it('keeps the Aggregates table and adds a Not applicable paragraph when deferred', async () => {
      const model = (await go({ tactical: 'deferred' })).tree.get(MODEL) ?? '';

      expect(model).toMatch(
        /## Aggregates\n\n\| Aggregate \|.*\n\| --- .*\n\nNot applicable: .*Transaction Script/,
      );
      expect(model).toContain('TODO: why');
    });

    it('writes the same output when full as when omitted', async () => {
      expect(await go({ tactical: 'full' })).toEqual(await go());
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

  it('leaves an already classified README untouched', async () => {
    const { tree } = await go(
      {},
      {
        ...workspace,
        [README]: '# Tenancy\n\n## Classification\n\nalready here\n',
      },
    );

    expect(tree.has(README)).toBe(false);
  });
});
