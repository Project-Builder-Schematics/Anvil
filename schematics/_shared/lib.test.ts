import { describe, expect, it } from 'bun:test';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import {
  addTsPath,
  assertDashed,
  assertPascal,
  camel,
  constant,
  dashed,
  commandFields,
  errorCodes,
  errorStatuses,
  subdomainNames,
  parseRoute,
  pascal,
  title,
  readRequired,
  resolveSlice,
  rewrite,
  row,
  table,
} from './lib.ts';

describe('naming', () => {
  it('converts between dash-case, PascalCase, camelCase and CONSTANT_CASE', () => {
    expect(pascal('order-card')).toBe('OrderCard');
    expect(camel('CreateOrder')).toBe('createOrder');
    expect(dashed('CreateOrder')).toBe('create-order');
    expect(constant('create-order')).toBe('CREATE_ORDER');
    expect(title('order-items')).toBe('Order items');
  });

  it('rejects names in the wrong case', () => {
    expect(() => assertDashed('Orders', 'context')).toThrow('dash-case');
    expect(() => assertPascal('createOrder', 'name')).toThrow('PascalCase');
  });
});

describe('file helpers', () => {
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
        '## Subdomains\n\n| Subdomain | R |\n| --- | --- |\n| [marketing](domain-model.md) | x |\n',
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
        '## Subdomains\n\n| Subdomain | R |\n| --- | --- |\n| [marketing-ops](domain-model.md) | x |\n',
    };

    expect(String((await run(seed)).error)).toContain('no domain model');
  });

  it('says the README does not list the slice when only an inline domain model exists', async () => {
    const seed = {
      'docs/growth/domain-model.md': '# m\n',
      'docs/growth/README.md': '# Growth\n',
    };

    expect(String((await run(seed)).error)).toContain(
      'docs/growth/README.md does not list marketing under "## Subdomains"',
    );
  });

  it('reads an unlinked subdomain name from the README table', async () => {
    const seed = {
      'docs/growth/domain-model.md': '# m\n',
      'docs/growth/README.md':
        '## Subdomains\n\n| Subdomain | R |\n| --- | --- |\n| marketing | x |\n',
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
  const base = `{\n  "compilerOptions": {\n    "paths": {\n      "@anvil/a": ["./libs/a/src/index.ts"]\n    },\n    "strict": true\n  }\n}\n`;

  it('appends an entry after the last path in prettier layout, changing nothing else', () => {
    expect(addTsPath(base, '@anvil/api-b', './libs/api/b/src/index.ts')).toBe(
      `{\n  "compilerOptions": {\n    "paths": {\n      "@anvil/a": ["./libs/a/src/index.ts"],\n      "@anvil/api-b": ["./libs/api/b/src/index.ts"]\n    },\n    "strict": true\n  }\n}\n`,
    );
  });

  it('appends an entry after the last path without disturbing the rest', () => {
    const out = addTsPath(base, '@anvil/api-b', './libs/api/b/src/index.ts');

    expect(paths(out)).toEqual({
      '@anvil/a': ['./libs/a/src/index.ts'],
      '@anvil/api-b': ['./libs/api/b/src/index.ts'],
    });
    expect(out).toContain(
      `      "@anvil/a": ["./libs/a/src/index.ts"],\n      "@anvil/api-b": ["./libs/api/b/src/index.ts"]\n    },`,
    );
  });

  it('fills an empty paths block', () => {
    const out = addTsPath(
      `{\n  "compilerOptions": {\n    "paths": {}\n  }\n}\n`,
      '@anvil/x',
      './x.ts',
    );

    expect(paths(out)).toEqual({
      '@anvil/x': ['./x.ts'],
    });
  });

  it('breaks a long entry the way prettier does', () => {
    const out = addTsPath(
      base,
      '@anvil/web-notifications-data-access',
      './libs/web/notifications/data-access/src/index.ts',
    );

    expect(out).toContain(
      `      "@anvil/web-notifications-data-access": [\n        "./libs/web/notifications/data-access/src/index.ts"\n      ]\n`,
    );
  });

  it('is idempotent', () => {
    expect(addTsPath(base, '@anvil/a', './elsewhere.ts')).toBe(base);
  });

  it('refuses a tsconfig without a paths block', () => {
    expect(() => addTsPath('{}', '@anvil/x', './x.ts')).toThrow('"paths"');
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

  it('reads the subdomain names of a README, linked or bare', () => {
    expect(
      subdomainNames(
        '## Subdomains\n\n| Subdomain | R |\n| --- | --- |\n| [marketing](domain-model.md) | x |\n| sales | y |\n',
      ),
    ).toEqual(['marketing', 'sales']);
  });

  it('lists the error codes the rules name, once each, in order', () => {
    const twice = model.replace(
      '| decided |',
      '| decided |\n| 2 | Again `BUDGET_REQUIRED`, or `CAMPAIGN_CLOSED`. | decided |',
    );

    expect(errorCodes(twice)).toEqual(['BUDGET_REQUIRED', 'CAMPAIGN_CLOSED']);
  });
});

describe('errorStatuses', () => {
  const model = (answers: string) =>
    [
      '## Business rules',
      '',
      '| # | Rule | Source |',
      '| --- | --- | --- |',
      '| 1 | One: `ONE_FAILED`. | decided |',
      '| 2 | Two: `TWO_FAILED`. | decided |',
      '| 3 | Three: `THREE_FAILED`. | decided |',
      '| 4 | Four: `FOUR_FAILED`. | decided |',
      '| 5 | Five names no code. | decided |',
      '',
      '## Driving adapters',
      '',
      '| Route | Use case | Answers | Caller |',
      '| --- | --- | --- | --- |',
      `| \`POST /things\` | \`MakeThing\` | ${answers} | token |`,
      '',
    ].join('\n');
  const statuses = (answers: string) => [...errorStatuses(model(answers))];

  it('maps the codes of the cited rules, ranges and lists included', () => {
    expect(statuses('201 · 422 rules 1–2, 4 · 404 rule 3')).toEqual([
      ['ONE_FAILED', 422],
      ['TWO_FAILED', 422],
      ['FOUR_FAILED', 422],
      ['THREE_FAILED', 404],
    ]);
  });

  it('reads each status on its own, so a cell never runs one citation into the next', () => {
    expect(statuses('422 rule 1 · 409 rule 2 · 404 rule 3')).toEqual([
      ['ONE_FAILED', 422],
      ['TWO_FAILED', 409],
      ['THREE_FAILED', 404],
    ]);
  });

  it('takes a status with no rule as a plain answer', () => {
    expect(statuses('200 · 400 · 404')).toEqual([]);
  });

  it('refuses a citation of a rule that names no error code, alone or inside a range', () => {
    expect(() => statuses('422 rule 5')).toThrow(
      '422 cites rule 5, which names no error code',
    );
    expect(() => statuses('422 rules 3–5')).toThrow(
      '422 cites rule 5, which names no error code',
    );
  });

  it('refuses a citation that is not a rule number or a range', () => {
    expect(() => statuses('422 rules 3–2')).toThrow('3–2');
    expect(() => statuses('422 rules 1,, 2')).toThrow('"" is not a rule');
  });

  it('refuses a rule the model does not have and a code answered two ways', () => {
    expect(() => statuses('422 rule 9')).toThrow('rule 9');
    expect(() => statuses('422 rule 1 · 409 rule 1')).toThrow(
      'ONE_FAILED is answered 422 and 409',
    );
  });
});

describe('commandFields', () => {
  it('lists the field names of a command type', () => {
    expect(commandFields('{ customerId }')).toEqual(['customerId']);
    expect(commandFields('{ a, b }')).toEqual(['a', 'b']);
    expect(commandFields('{}')).toEqual([]);
  });

  it('reads names, not their types, optional marks or nested shapes', () => {
    expect(
      commandFields(
        '{ lines: Line[], note?: string, at: { x: number, y: number }, id }',
      ),
    ).toEqual(['lines', 'note', 'at', 'id']);
    expect(commandFields('{ pair: Map<string, number>, last }')).toEqual([
      'pair',
      'last',
    ]);
  });

  it('does not take the arrow of a function type for a closing bracket', () => {
    expect(
      commandFields('{ done: (id: string) => void, last: string }'),
    ).toEqual(['done', 'last']);
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
