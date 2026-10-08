import { describe, expect, it } from 'bun:test';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import {
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
  readRequired,
  resolveSlice,
  rewrite,
  row,
  table,
  createFile,
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

describe('file helpers', () => {
  it('keeps the template delimiter in a new file literal, as in a replaced one', async () => {
    const result = await runFactoryForTest(() => {
      createFile('new.md', 'use {= as is, then {= again');
    }, {} as never);

    const [instruction] = result.emitted.flatMap((batch) => batch.instructions);
    expect(JSON.stringify(instruction)).toContain(
      '"template":"use {= \\"{=\\" =} as is, then {= \\"{=\\" =} again"',
    );
  });

  it('fails closed on a missing required file, naming the way to create it', async () => {
    const result = await runFactoryForTest(async () => {
      await readRequired('missing.txt', 'create it first');
    }, {} as never);

    expect(String(result.error)).toContain(
      'missing.txt not found — create it first',
    );
  });

  it('rewrites a file only when the edit changed it', async () => {
    const result = await runFactoryForTest(
      () => {
        rewrite('same.txt', 'a', 'a');
        rewrite('changed.txt', 'a', 'b');
      },
      {} as never,
      { seed: { 'same.txt': 'a', 'changed.txt': 'a' } },
    );

    expect([...result.tree]).toEqual([['changed.txt', 'b']]);
  });
});

describe('resolveSlice', () => {
  const run = (seed: Record<string, string>, slice = 'marketing') =>
    runFactoryForTest(
      async () => {
        const out = await resolveSlice('growth', slice);
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
