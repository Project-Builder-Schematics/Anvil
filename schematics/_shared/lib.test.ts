import { describe, expect, it } from 'bun:test';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import {
  addContextRelation,
  addLintContext,
  addModuleEntry,
  addTsPath,
  assertDashed,
  assertPascal,
  camel,
  constant,
  dashed,
  errorCodes,
  numberedRules,
  parseRoute,
  pascal,
  sentence,
  title,
  resolveSlice,
  row,
  table,
  withImports,
  withNamedImports,
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

  it('writes names as words', () => {
    expect(sentence('CreateOrder')).toBe('Create order');
    expect(title('order-items')).toBe('Order items');
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

  it('creates a path the run found missing and replaces one it found', async () => {
    const factory = async () => {
      const buffer = writeBuffer();
      await buffer.write('old.txt', 'changed');
      await buffer.write('new.txt', 'fresh');
      buffer.flush();
    };
    const result = await runFactoryForTest(factory, {} as never, {
      seed: { 'old.txt': 'before' },
    });

    expect(
      result.emitted
        .flatMap((batch) => batch.instructions)
        .map((instruction) =>
          instruction.op === 'create'
            ? ['create', instruction.create.pathTemplate]
            : instruction.op === 'modify'
              ? ['modify', instruction.modify.path]
              : [instruction.op],
        ),
    ).toEqual([
      ['modify', 'old.txt'],
      ['create', 'new.txt'],
    ]);
  });

  it('keeps the template delimiter in a new file literal, as in a replaced one', async () => {
    const factory = async () => {
      const buffer = writeBuffer();
      await buffer.write('new.md', 'use {= as is, then {= again');
      buffer.flush();
    };
    const result = await runFactoryForTest(factory, {} as never);

    const [instruction] = result.emitted.flatMap((batch) => batch.instructions);
    expect(JSON.stringify(instruction)).toContain(
      '"template":"use {= \\"{=\\" =} as is, then {= \\"{=\\" =} again"',
    );
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

  it('does not take a longer slice name for the one asked for', async () => {
    const seed = {
      'docs/growth/domain-model.md': '# m\n',
      'docs/growth/README.md':
        '| Subdomain | R |\n| --- | --- |\n| [marketing-ops](domain-model.md) | x |\n',
    };

    expect(String((await run(seed)).error)).toContain('no domain model');
  });

  it('reads an unlinked subdomain name from the README table', async () => {
    const seed = {
      'docs/growth/domain-model.md': '# m\n',
      'docs/growth/README.md':
        '| Subdomain | R |\n| --- | --- |\n| marketing | x |\n',
    };

    expect(await resolved(seed)).toMatchObject({ segment: '' });
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

describe('addContextRelation', () => {
  const config = `const contexts = ['a', 'b'];\nconst contextRelations = [\n  ['a', 'b'],\n];\n`;

  it('appends the edge once', () => {
    const out = addContextRelation(config, 'b', 'a');

    expect(out).toContain(`  ['a', 'b'],\n  ['b', 'a'],\n];`);
    expect(addContextRelation(out, 'b', 'a')).toBe(out);
  });

  it('fills an empty list', () => {
    expect(addContextRelation('const contextRelations = [];\n', 'a', 'b')).toBe(
      `const contextRelations = [\n  ['a', 'b'],\n];\n`,
    );
  });

  it('reads the list whatever its formatting, comments and quotes', () => {
    const formatted = [
      'const contextRelations = [ // from, to',
      '  [ "a" , \'b\' ], /* kept out of the way ] */',
      "  ['c', 'd']",
      '];',
      'const layers = [];',
      '',
    ].join('\n');

    const out = addContextRelation(formatted, 'b', 'a');

    expect(out).toBe(
      "const contextRelations = [\n  ['a', 'b'],\n  ['c', 'd'],\n  ['b', 'a'],\n];\nconst layers = [];\n",
    );
    expect(addContextRelation(formatted, 'c', 'd')).toBe(formatted);
  });

  it('reads a list on one line', () => {
    expect(
      addContextRelation("const contextRelations = [['a', 'b']];\n", 'b', 'a'),
    ).toBe("const contextRelations = [\n  ['a', 'b'],\n  ['b', 'a'],\n];\n");
  });

  it('refuses an entry that is not a pair of names', () => {
    expect(() =>
      addContextRelation(
        "const contextRelations = [\n  ['a', 'b'],\n  ...more,\n];\n",
        'b',
        'a',
      ),
    ).toThrow('contextRelations has an entry');
  });

  it('refuses a config without the list', () => {
    expect(() => addContextRelation('export default [];', 'a', 'b')).toThrow(
      'contextRelations',
    );
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

  it('lists the error codes the rules name, once each, in order', () => {
    const twice = model.replace(
      '| decided |',
      '| decided |\n| 2 | Again `BUDGET_REQUIRED`, or `CAMPAIGN_CLOSED`. | decided |',
    );

    expect(errorCodes(twice)).toEqual(['BUDGET_REQUIRED', 'CAMPAIGN_CLOSED']);
  });
});

describe('parseRoute', () => {
  it('splits a route into method, resource and path', () => {
    expect(parseRoute('POST /orders/:id/lines')).toEqual({
      method: 'POST',
      resource: 'orders',
      path: '/:id/lines',
    });
    expect(parseRoute('GET /orders')).toEqual({
      method: 'GET',
      resource: 'orders',
      path: '/',
    });
  });

  it('rejects what is not a route', () => {
    expect(parseRoute('FETCH /orders')).toBeUndefined();
    expect(parseRoute('GET orders')).toBeUndefined();
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

  it('adds imports right after a side-effect import', () => {
    const out = withImports(
      "import './polyfill';\n\nconst x = 1;\nexport { y } from './y';\n",
      ["import b from 'b';"],
    );

    expect(out).toBe(
      "import './polyfill';\nimport b from 'b';\n\nconst x = 1;\nexport { y } from './y';\n",
    );
  });

  it('adds imports after a multi-line import', () => {
    const out = withImports(
      "import {\n  a,\n  b,\n} from 'ab';\n\nconst x = 1;\n",
      ["import c from 'c';"],
    );

    expect(out).toBe(
      "import {\n  a,\n  b,\n} from 'ab';\nimport c from 'c';\n\nconst x = 1;\n",
    );
  });

  it('merges names into an existing import of the same module, sorted', () => {
    const out = withNamedImports(
      "import { Post, Controller } from '@nestjs/common';\nconst x = 1;\n",
      '@nestjs/common',
      ['Get', 'Post'],
    );

    expect(out).toBe(
      "import { Controller, Get, Post } from '@nestjs/common';\nconst x = 1;\n",
    );
  });

  it('creates the import of a module it does not have yet', () => {
    expect(withNamedImports('const x = 1;\n', 'zod', ['z'])).toBe(
      "import { z } from 'zod';\n\nconst x = 1;\n",
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
