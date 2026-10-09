import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import hexBoundedContext from '../hex-bounded-context/factory.ts';
import hexContext from '../hex-context/factory.ts';
import { after, invoicingDocs, run, throwIfFailed } from './testing.ts';

// runFactoryForTest only compares strings, so it misses a generated file that imports
// something that does not exist or does not typecheck. This generates a whole context into a
// temp tree, links the repo's node_modules and runs tsc on it, as the lib's own projects would.

const repo = resolve(import.meta.dir, '../..');
const real = (path: string): string => readFileSync(join(repo, path), 'utf8');

const generate = async (): Promise<Record<string, string>> => {
  let tree: Record<string, string> = {
    'tsconfig.base.json': real('tsconfig.base.json'),
    'eslint.config.mjs': real('eslint.config.mjs'),
    'apps/api/src/app/app.module.ts': real('apps/api/src/app/app.module.ts'),
  };
  const step = async (
    f: Parameters<typeof run>[0],
    schematic: string,
    input: Record<string, unknown>,
  ) => {
    const result = await run(f, schematic, input, tree);
    throwIfFailed(result);
    tree = after(tree, result.tree);
  };
  const context = {
    subdomain_class: 'core',
    criticality: 'high',
    volatility: 'low',
  };
  await step(hexBoundedContext, 'hex-bounded-context', {
    ...context,
    context: 'ledger',
    purpose: 'Keeps the books.',
  });
  await step(hexBoundedContext, 'hex-bounded-context', {
    ...context,
    context: 'billing',
    purpose: 'Bills customers.',
    subdomains: 'invoicing,payouts',
    context_map: 'ledger:conformist',
  });
  // The docs a human writes after the skeleton: the model and features of invoicing, a bare payouts.
  tree = {
    ...tree,
    ...invoicingDocs,
    'docs/billing/README.md': tree['docs/billing/README.md'] ?? '',
    'docs/billing/glossary.md': tree['docs/billing/glossary.md'] ?? '',
  };
  await step(hexContext, 'hex-context', { context: 'billing' });
  return tree;
};

// What the generated filter does with a domain error, run on the generated files themselves.
const FILTER_CHECK = `import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { InvoicingError } from './libs/api/billing/src/invoicing/domain/errors';
import { InvoicingErrorFilter } from './libs/api/billing/src/invoicing/infrastructure/http/InvoicingErrorFilter';

const logged: string[] = [];
Logger.overrideLogger({
  log: () => undefined,
  warn: () => undefined,
  error: (message: unknown) => logged.push(String(message)),
});
const replies: unknown[] = [];
const adapter = { reply: (_response: unknown, body: unknown, status: number) => replies.push([body, status]) };
const host = { switchToHttp: () => ({ getResponse: () => 'response' }) };
const filter = new InvoicingErrorFilter(adapter as never);
filter.catch(new InvoicingError('LINES_REQUIRED'), host as never);
filter.catch(new InvoicingError('CUSTOMER_UNKNOWN'), host as never);
console.log(JSON.stringify({
  replies,
  logged,
  catches: Reflect.getMetadata('__filterCatchExceptions__', InvoicingErrorFilter).map((type: { name: string }) => type.name),
}));
`;

const exec = (
  cwd: string,
  bin: string,
  args: string[],
): { code: number; output: string } => {
  const result = Bun.spawnSync(
    [join(repo, 'node_modules/.bin', bin), ...args],
    { cwd },
  );
  return {
    code: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  };
};

describe('a generated context', () => {
  let root = '';

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'schematics-tsc-'));
    for (const [path, content] of Object.entries(await generate())) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'));
  }, 60_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('typechecks the lib and its specs, including the controller, the module and the steps', () => {
    expect(
      exec(root, 'tsc', ['-p', 'libs/api/billing/tsconfig.lib.json']),
    ).toEqual({ code: 0, output: '' });
    expect(
      exec(root, 'tsc', ['-p', 'libs/api/billing/tsconfig.spec.json']),
    ).toEqual({ code: 0, output: '' });
  }, 120_000);

  it('answers a domain error with its documented status, logs one no route maps and catches only its own class', () => {
    writeFileSync(join(root, 'check-filter.ts'), FILTER_CHECK);
    const result = Bun.spawnSync([process.execPath, 'check-filter.ts'], {
      cwd: root,
    });

    expect(result.stderr.toString()).toBe('');
    expect(JSON.parse(result.stdout.toString())).toEqual({
      replies: [
        [{ statusCode: 422, code: 'LINES_REQUIRED' }, 422],
        [{ statusCode: 500, code: 'CUSTOMER_UNKNOWN' }, 500],
      ],
      logged: [expect.stringContaining('CUSTOMER_UNKNOWN')],
      catches: ['InvoicingError'],
    });
  });

  it("passes the repo's strictTypeChecked lint", () => {
    const result = Bun.spawnSync(
      [join(repo, 'node_modules/.bin/eslint'), '-f', 'json', 'libs/api'],
      { cwd: root },
    );
    const stdout = result.stdout.toString();
    // nx's rules print warnings to stdout ahead of the JSON report.
    const files = JSON.parse(
      stdout.slice(stdout.indexOf('[{"filePath"')),
    ) as Array<{
      filePath: string;
      messages: Array<{ severity: number; message: string }>;
    }>;
    const errors = files.flatMap((f) =>
      f.messages
        .filter((m) => m.severity === 2)
        .map((m) => `${f.filePath}: ${m.message}`),
    );

    expect(errors).toEqual([]);
    expect(files.length).toBeGreaterThan(10);
  }, 120_000);
});
