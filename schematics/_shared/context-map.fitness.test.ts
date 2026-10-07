import { describe, expect, it } from 'bun:test';
import { ESLint } from 'eslint';

// Runs the real root lint config over virtual files, so it proves the boundaries
// the repo enforces, not a copy of them.
const eslint = new ESLint({ cwd: `${import.meta.dir}/../..` });

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
