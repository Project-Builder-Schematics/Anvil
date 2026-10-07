import { describe, expect, it } from 'bun:test';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import { find } from '@pbuilder/sdk/commons';
import {
  addLintContext,
  addModuleEntry,
  addTsPath,
  assertDashed,
  assertPascal,
  camel,
  constant,
  dashed,
  numberedRules,
  pascal,
  resolveSlice,
  row,
  table,
  withImports,
  withStatement,
  writeBuffer,
} from './lib.ts';

describe('naming', () => {
  it('converts between dash-case, PascalCase, camelCase and CONSTANT_CASE', () => {
    expect(pascal('order-card')).toBe('OrderCard');
    expect(camel('CreateOrder')).toBe('createOrder');
    expect(dashed('CreateOrder')).toBe('create-order');
    expect(constant('create-order')).toBe('CREATE_ORDER');
  });

  it('rejects names in the wrong case', () => {
    expect(() => assertDashed('Orders', 'context')).toThrow('dash-case');
    expect(() => assertPascal('createOrder', 'name')).toThrow('PascalCase');
  });
});

describe('writeBuffer', () => {
  it('emits one directive per path however many times it is written', async () => {
    const factory = async () => {
      const buffer = writeBuffer();
      await buffer.write('a.txt', 'one');
      await buffer.write('a.txt', 'two');
      await buffer.write('b.txt', 'new');
      buffer.flush();
    };
    const result = await runFactoryForTest(factory, {} as never, {
      seed: { 'a.txt': 'zero' },
    });

    expect(result.error).toBeUndefined();
    expect(result.tree.get('a.txt')).toBe('two');
    expect(result.tree.get('b.txt')).toBe('new');
    expect(result.emitted.flatMap((batch) => batch.instructions)).toHaveLength(
      2,
    );
  });

  it('writes nothing for a file whose final content equals what it held', async () => {
    const factory = async () => {
      const buffer = writeBuffer();
      await buffer.write('a.txt', 'same');
      buffer.flush();
    };
    const result = await runFactoryForTest(factory, {} as never, {
      seed: { 'a.txt': 'same' },
    });

    expect([...result.tree.keys()]).toEqual([]);
  });

  it('reads back what it has pending and fails closed on a missing required file', async () => {
    const factory = async () => {
      const buffer = writeBuffer();
      await buffer.write('a.txt', 'pending');
      if ((await buffer.read('a.txt')) !== 'pending')
        throw new Error('did not read pending');
      await buffer.readRequired('missing.txt', 'create it first');
    };
    const result = await runFactoryForTest(factory, {} as never);

    expect(String(result.error)).toContain(
      'missing.txt not found — create it first',
    );
  });

  it('is usable without an engine read of a path that was never seeded', async () => {
    const result = await runFactoryForTest(async () => {
      expect(await find('nope.txt').read()).toBeUndefined();
    }, {} as never);
    expect(result.error).toBeUndefined();
  });
});

describe('resolveSlice', () => {
  const run = (seed: Record<string, string>, slice = 'marketing') =>
    runFactoryForTest(
      async () => {
        const out = await resolveSlice('growth', slice, writeBuffer());
        throw new Error(JSON.stringify(out));
      },
      {} as never,
      { seed },
    );
  const resolved = async (seed: Record<string, string>, slice?: string) =>
    JSON.parse(
      String((await run(seed, slice)).error).replace(/^Error: /, ''),
    ) as unknown;

  it('is nested when the subdomain has its own domain model', async () => {
    expect(
      await resolved({ 'docs/growth/marketing/domain-model.md': '# m\n' }),
    ).toEqual({
      code: 'libs/api/growth/src/marketing',
      docs: 'docs/growth/marketing',
      segment: 'marketing/',
    });
  });

  it('is inline when the context keeps one domain model and its README lists the slice', async () => {
    const seed = {
      'docs/growth/domain-model.md': '# m\n',
      'docs/growth/README.md':
        '| Subdomain | R |\n| --- | --- |\n| [marketing](domain-model.md) | x |\n',
    };

    expect(await resolved(seed)).toEqual({
      code: 'libs/api/growth/src',
      docs: 'docs/growth',
      segment: '',
    });
  });

  it('refuses a slice with no domain model, pointing at the docs generator', async () => {
    expect(String((await run({})).error)).toContain(
      'write the docs first: hex-bounded-context',
    );
  });
});

const paths = (tsconfig: string): unknown =>
  (JSON.parse(tsconfig) as { compilerOptions: { paths: unknown } })
    .compilerOptions.paths;

describe('addTsPath', () => {
  const base = `{\n  "compilerOptions": {\n    "paths": {\n      "@demo/a": ["./libs/a/src/index.ts"]\n    },\n    "strict": true\n  }\n}\n`;

  it('appends an entry after the last path in prettier layout, changing nothing else', () => {
    expect(addTsPath(base, '@demo/api-b', './libs/api/b/src/index.ts')).toBe(
      `{\n  "compilerOptions": {\n    "paths": {\n      "@demo/a": ["./libs/a/src/index.ts"],\n      "@demo/api-b": ["./libs/api/b/src/index.ts"]\n    },\n    "strict": true\n  }\n}\n`,
    );
  });

  it('appends an entry after the last path without disturbing the rest', () => {
    const out = addTsPath(base, '@demo/api-b', './libs/api/b/src/index.ts');

    expect(paths(out)).toEqual({
      '@demo/a': ['./libs/a/src/index.ts'],
      '@demo/api-b': ['./libs/api/b/src/index.ts'],
    });
    expect(out).toContain(
      `      "@demo/a": ["./libs/a/src/index.ts"],\n      "@demo/api-b": ["./libs/api/b/src/index.ts"]\n    },`,
    );
  });

  it('fills an empty paths block', () => {
    const out = addTsPath(
      `{\n  "compilerOptions": {\n    "paths": {}\n  }\n}\n`,
      '@demo/x',
      './x.ts',
    );

    expect(paths(out)).toEqual({
      '@demo/x': ['./x.ts'],
    });
  });

  it('breaks a long entry the way prettier does', () => {
    const out = addTsPath(
      base,
      '@demo/web-notifications-data-access',
      './libs/web/notifications/data-access/src/index.ts',
    );

    expect(out).toContain(
      `      "@demo/web-notifications-data-access": [\n        "./libs/web/notifications/data-access/src/index.ts"\n      ]\n`,
    );
  });

  it('is idempotent', () => {
    expect(addTsPath(base, '@demo/a', './elsewhere.ts')).toBe(base);
  });

  it('refuses a tsconfig without a paths block', () => {
    expect(() => addTsPath('{}', '@demo/x', './x.ts')).toThrow('"paths"');
  });
});

describe('addLintContext', () => {
  const config = `const contexts = [\n  'catalog',\n  'ordering',\n];\nconst layers = [];\n`;

  it('adds the context to the contexts list once', () => {
    const out = addLintContext(config, 'billing');

    expect(out).toContain(`  'ordering',\n  'billing',\n];`);
    expect(addLintContext(out, 'billing')).toBe(out);
  });

  it('refuses a config without the list', () => {
    expect(() => addLintContext('export default [];', 'x')).toThrow('contexts');
  });
});

describe('domain model tables', () => {
  const model = [
    '# M — domain model',
    '',
    '## Business rules',
    '',
    '| # | Rule | Source |',
    '| --- | --- | --- |',
    '| 1 | A campaign without a budget is rejected with `BUDGET_REQUIRED`. | decided |',
    '',
    '## Use cases',
    '',
    '| Use case | Command | Result | Driven ports | Feature |',
    '| --- | --- | --- | --- | --- |',
    '| `LaunchCampaign` | `{ id }` | `{ ok }` | `Repo`, `Clock` | [launch.feature](launch.feature) |',
    '',
  ].join('\n');

  it('reads data rows under a heading, stripping backticks', () => {
    expect(table(model, 'Use cases')).toEqual([
      [
        'LaunchCampaign',
        '{ id }',
        '{ ok }',
        'Repo, Clock',
        '[launch.feature](launch.feature)',
      ],
    ]);
    expect(row(model, 'Use cases', 'LaunchCampaign')?.[3]).toBe('Repo, Clock');
    expect(row(model, 'Use cases', 'Other')).toBeUndefined();
  });

  it('reads numbered rules from the table', () => {
    expect(numberedRules(model).get(1)).toContain('BUDGET_REQUIRED');
  });
});

describe('source edits', () => {
  it('adds imports after the last import and skips present ones', () => {
    const out = withImports("import a from 'a';\n\nconst x = 1;\n", [
      "import b from 'b';",
      "import a from 'a';",
    ]);

    expect(out).toBe(
      "import a from 'a';\nimport b from 'b';\n\nconst x = 1;\n",
    );
  });

  it('appends a statement once', () => {
    const once = withStatement('const a = 1;\n', 'const b = 2;');

    expect(once).toBe('const a = 1;\n\nconst b = 2;\n');
    expect(withStatement(once, 'const b = 2;')).toBe(once);
  });
});

describe('addModuleEntry', () => {
  it('expands an empty module and renders the keys in a fixed order', () => {
    const empty = '@Module({})\nexport class OrderingModule {}\n';
    const out = addModuleEntry(
      addModuleEntry(empty, 'providers', 'A'),
      'controllers',
      'C',
    );

    expect(out).toBe(
      '@Module({\n  controllers: [C],\n  providers: [A],\n})\nexport class OrderingModule {}\n',
    );
  });

  it('keeps entries, adds new ones and ignores duplicates, whatever the whitespace', () => {
    const source =
      '@Module({\n  providers: [\n    { provide: X, useFactory: f, inject: [Y] },\n  ],\n})\nexport class M {}\n';
    const out = addModuleEntry(
      source,
      'providers',
      '{ provide: Z, useClass: Zed }',
    );

    expect(out).toContain('{ provide: X, useFactory: f, inject: [Y] }');
    expect(out).toContain('{ provide: Z, useClass: Zed }');
    expect(addModuleEntry(out, 'providers', '{provide:Z,useClass:Zed}')).toBe(
      out,
    );
  });

  it('refuses a source without a Module decorator', () => {
    expect(() =>
      addModuleEntry('export class M {}\n', 'providers', 'A'),
    ).toThrow('@Module');
  });
});
