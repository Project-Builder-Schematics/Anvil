import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { RELATIONSHIPS, table } from './lib.ts';

// Runs the real root lint config over virtual files, so it proves the boundaries
// the repo enforces, not a copy of them.
const root = `${import.meta.dir}/../..`;
const eslint = new ESLint({ cwd: root });

const boundaryErrors = async (
  context: string,
  code: string,
): Promise<string[]> => {
  const [result] = await eslint.lintText(code, {
    filePath: `libs/api/${context}/src/composition.ts`,
  });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === '@nx/enforce-module-boundaries')
    .map((message) => message.message);
};

describe('the context map in the lint boundaries', () => {
  it('accepts the barrel of a declared relation', async () => {
    expect(
      await boundaryErrors('shipping', "import '@demo/api-ordering';\n"),
    ).toEqual([]);
  });

  it('rejects the barrel of an undeclared relation', async () => {
    const errors = await boundaryErrors(
      'shipping',
      "import '@demo/api-catalog';\n",
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(
      'can only depend on libs tagged with "context:shipping", "context:shared", "context:ordering"',
    );
  });

  it('rejects the reverse of a declared relation', async () => {
    expect(
      await boundaryErrors('ordering', "import '@demo/api-shipping';\n"),
    ).toHaveLength(1);
  });

  // `@demo/api-<ctx>/src/...` has no tsconfig path, so tsc (the typecheck target) rejects it;
  // the lint rule only sees what resolves, so the relative form is the one it can reject.
  it('rejects a relative deep import into a declared context', async () => {
    const errors = await boundaryErrors(
      'shipping',
      "import '../../ordering/src/index';\n",
    );

    expect(errors).toHaveLength(1);
  });
});

interface DepConstraint {
  sourceTag: string;
  onlyDependOnLibsWithTags: string[];
}

/** What the real lint config lets each context depend on, besides itself and the shared kernel. */
const lintedRelations = async (): Promise<Record<string, string[]>> => {
  const config = (await eslint.calculateConfigForFile(
    'libs/api/ordering/src/composition.ts',
  )) as { rules?: Record<string, unknown> };
  const [, options] = config.rules?.['@nx/enforce-module-boundaries'] as [
    string,
    { depConstraints: DepConstraint[] },
  ];
  return Object.fromEntries(
    options.depConstraints
      .filter(
        ({ sourceTag }) =>
          sourceTag.startsWith('context:') && sourceTag !== 'context:shared',
      )
      .map(({ sourceTag, onlyDependOnLibsWithTags }) => {
        const context = sourceTag.slice('context:'.length);
        return [
          context,
          onlyDependOnLibsWithTags
            .map((tag) => tag.slice('context:'.length))
            .filter((tag) => tag !== context && tag !== 'shared')
            .sort(),
        ];
      }),
  );
};

/** The Context map table of each context's README: [provider, relationship] rows. */
const documentedRelations = (context: string): string[][] => {
  const path = `${root}/docs/${context}/README.md`;
  return existsSync(path)
    ? table(readFileSync(path, 'utf8'), 'Context map')
    : [];
};

describe('the context map in the docs and in the lint boundaries', () => {
  it('declares the same relations in both', async () => {
    const linted = await lintedRelations();
    const documented = Object.fromEntries(
      Object.keys(linted).map((context) => [
        context,
        documentedRelations(context)
          .map(([provider = '']) => provider)
          .sort(),
      ]),
    );

    expect(Object.values(linted).flat().length).toBeGreaterThan(0);
    expect(documented).toEqual(linted);
  });

  it('uses a known relationship in every row of every table', async () => {
    const rows = Object.keys(await lintedRelations()).flatMap(
      documentedRelations,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const [provider, relationship] of rows)
      expect(RELATIONSHIPS, `${provider}: ${relationship}`).toContain(
        relationship ?? '',
      );
  });
});
