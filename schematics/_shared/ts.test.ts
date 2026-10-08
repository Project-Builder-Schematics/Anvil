import { describe, expect, it } from 'bun:test';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import { create } from '@pbuilder/sdk/commons';
import {
  addContextRelation,
  addLintContext,
  addModuleEntry,
  addReExport,
  startRun,
  withAst,
} from './ts.ts';

const edit = async (
  seed: Record<string, string>,
  factory: (run: ReturnType<typeof startRun>) => Promise<void> | void,
) => {
  const result = await runFactoryForTest(
    async () => {
      const run = startRun();
      await factory(run);
      await run.flush();
    },
    {} as never,
    { seed },
  );
  return {
    error: result.error,
    tree: result.tree,
    directives: result.emitted.flatMap((batch) => batch.instructions),
  };
};

describe('startRun', () => {
  it('applies every edit queued for a path on one handle, so the path is written once', async () => {
    const { error, tree, directives } = await edit(
      { 'a.ts': 'export const a = 1;\n', 'b.ts': 'export const b = 1;\n' },
      (run) => {
        run.edit('a.ts', (file) => file.addImport('x', './x'));
        run.edit('b.ts', (file) => file.addImport('y', './y'));
        run.edit('a.ts', (file) => file.addVariable('c', '2'));
        run.edit('b.ts', (file) => file.addVariable('d', '3'));
      },
    );

    expect(error).toBeUndefined();
    expect(
      directives.map((d) => (d.op === 'modify' ? d.modify.path : d.op)),
    ).toEqual(['a.ts', 'b.ts']);
    expect(tree.get('a.ts')).toContain('import { x } from "./x"');
    expect(tree.get('a.ts')).toContain('const c = 2;');
    expect(tree.get('b.ts')).toContain('const d = 3;');
  });

  it('edits a file the run created', async () => {
    const { error, tree } = await edit({}, (run) => {
      create('n.ts', { template: 'export const n = 1;\n', options: {} });
      run.edit('n.ts', (file) => file.addVariable('m', '2'));
    });

    expect(error).toBeUndefined();
    expect(tree.get('n.ts')).toContain('export const n = 1;');
    expect(tree.get('n.ts')).toContain('const m = 2;');
  });

  it('writes nothing for edits that change nothing', async () => {
    const { error, directives } = await edit(
      { 'a.ts': 'import { x } from "./x";\n' },
      (run) => {
        run.edit('a.ts', (file) => file.addImport('x', './x'));
      },
    );

    expect(error).toBeUndefined();
    expect(directives).toEqual([]);
  });

  it('fails a file that does not exist', async () => {
    const { error } = await edit({}, (run) => {
      run.edit('missing.ts', (file) => file.addImport('x', './x'));
    });

    expect(String(error)).toContain('missing.ts');
  });
});

describe('withAst', () => {
  it('returns what the callback read and keeps the file unchanged', async () => {
    let found = 0;
    const { error, directives } = await edit(
      { 'a.ts': 'export const a = 1;\nexport const b = 2;\n' },
      (run) => {
        run.edit('a.ts', async (file) => {
          found = await withAst(
            file,
            (ast) => ast.getVariableStatements().length,
          );
        });
      },
    );

    expect(error).toBeUndefined();
    expect(found).toBe(2);
    expect(directives).toEqual([]);
  });

  it('rethrows the callback error with its own message, which modify() would hide', async () => {
    const { error } = await edit({ 'a.ts': 'export {};\n' }, (run) => {
      run.edit('a.ts', (file) =>
        withAst(file, () => {
          throw new Error('the real reason');
        }),
      );
    });

    expect(String(error)).toContain('the real reason');
  });
});

describe('addModuleEntry', () => {
  const module = (body: string) => `@Module(${body})\nexport class M {}\n`;
  const go = async (
    source: string,
    adds: Array<['imports' | 'controllers' | 'providers' | 'exports', string]>,
  ) => {
    const result = await edit({ 'm.ts': source }, (run) => {
      run.edit('m.ts', (file) =>
        withAst(file, (ast) => {
          for (const [key, entry] of adds) addModuleEntry(ast, key, entry);
        }),
      );
    });
    return { error: result.error, source: result.tree.get('m.ts') ?? source };
  };

  it('expands an empty module and keeps the keys in a fixed order', async () => {
    const { source } = await go(module('{}'), [
      ['providers', 'A'],
      ['controllers', 'C'],
      ['exports', 'A'],
      ['imports', 'I'],
    ]);

    expect(source.replace(/\s+/g, ' ')).toContain(
      '@Module({ imports: [I], controllers: [C], providers: [A], exports: [A] })',
    );
  });

  it('keeps entries, adds new ones and ignores duplicates, whatever the whitespace', async () => {
    const start = module(
      '{\n  providers: [\n    { provide: X, useFactory: f, inject: [Y] },\n  ],\n}',
    );
    const { source } = await go(start, [
      ['providers', '{ provide: Z, useClass: Zed }'],
      ['providers', '{provide:Z,useClass:Zed}'],
    ]);

    expect(source).toContain('{ provide: X, useFactory: f, inject: [Y] }');
    expect(source.match(/useClass: Zed/g)).toHaveLength(1);
  });

  it('refuses a source without a Module decorator', async () => {
    const { error } = await go('export class M {}\n', [['providers', 'A']]);

    expect(String(error)).toContain('@Module');
  });
});

describe('addReExport', () => {
  const go = async (
    source: string,
    adds: Array<[string, string[]?, boolean?]>,
  ) => {
    const result = await edit({ 'index.ts': source }, (run) => {
      run.edit('index.ts', (file) =>
        withAst(file, (ast) => {
          for (const [from, names, typeOnly] of adds)
            addReExport(ast, from, names, typeOnly);
        }),
      );
    });
    return result.tree.get('index.ts') ?? source;
  };

  it('adds a star export once', async () => {
    const out = await go("export * from './a';\n", [['./b'], ['./b'], ['./a']]);

    expect(out.match(/export \* from/g)).toHaveLength(2);
    expect(out).toContain('"./b"');
  });

  it('replaces the empty-module placeholder', async () => {
    const out = await go('export {};\n', [['./lib/x']]);

    expect(out).not.toContain('export {}');
    expect(out).toContain('export * from "./lib/x"');
  });

  it('adds named and type-only exports once', async () => {
    const out = await go("export { M } from './composition';\n", [
      ['./application/A', ['A_TOKEN']],
      ['./application/A', ['A_TOKEN']],
      ['./application/A', ['A', 'AResult'], true],
      ['./application/A', ['A', 'AResult'], true],
    ]);

    expect(out.match(/A_TOKEN/g)).toHaveLength(1);
    expect(out.match(/export type/g)).toHaveLength(1);
    expect(out).toContain('export type { A, AResult } from "./application/A"');
  });
});

describe('addLintContext', () => {
  const config = `const contexts = [\n  'catalog',\n  'ordering',\n];\nconst layers = [];\n`;
  const go = async (source: string, contexts: string[]) => {
    const result = await edit({ 'eslint.config.mjs': source }, (run) => {
      run.edit('eslint.config.mjs', (file) =>
        withAst(file, (ast) => {
          for (const context of contexts) addLintContext(ast, context);
        }),
      );
    });
    return {
      error: result.error,
      out: result.tree.get('eslint.config.mjs') ?? source,
    };
  };

  it('adds the context to the contexts list once', async () => {
    const { out } = await go(config, ['billing', 'billing']);

    expect(out.match(/billing/g)).toHaveLength(1);
    expect(out).toContain('catalog');
  });

  it('refuses a config without the list', async () => {
    const { error } = await go('export default [];\n', ['x']);

    expect(String(error)).toContain('contexts');
  });
});

describe('addContextRelation', () => {
  const go = async (source: string, relations: Array<[string, string]>) => {
    const result = await edit({ 'eslint.config.mjs': source }, (run) => {
      run.edit('eslint.config.mjs', (file) =>
        withAst(file, (ast) => {
          for (const [from, to] of relations) addContextRelation(ast, from, to);
        }),
      );
    });
    return {
      error: result.error,
      out: result.tree.get('eslint.config.mjs') ?? source,
    };
  };

  it('appends the edge once and fills an empty list', async () => {
    const { out } = await go('const contextRelations = [];\n', [
      ['a', 'b'],
      ['a', 'b'],
      ['b', 'a'],
    ]);

    expect(out.replace(/\s+/g, '')).toContain(
      `constcontextRelations=[["a","b"],["b","a"]];`.replaceAll('"', "'"),
    );
  });

  it('reads the list whatever its formatting, comments and quotes', async () => {
    const formatted = [
      'const contextRelations = [ // from, to',
      '  [ "a" , \'b\' ], /* kept out of the way ] */',
      "  ['c', 'd']",
      '];',
      'const layers = [];',
      '',
    ].join('\n');

    const { out } = await go(formatted, [
      ['b', 'a'],
      ['c', 'd'],
    ]);

    expect(out).toContain('// from, to');
    expect(out).toContain('/* kept out of the way ] */');
    expect(out.match(/'b'|"b"/g)).toHaveLength(2);
    expect(out.match(/'d'|"d"/g)).toHaveLength(1);
  });

  it('refuses an entry that is not a pair of names', async () => {
    const { error } = await go(
      "const contextRelations = [\n  ['a', 'b'],\n  ...more,\n];\n",
      [['b', 'a']],
    );

    expect(String(error)).toContain('contextRelations has an entry');
  });

  it('refuses a config without the list', async () => {
    const { error } = await go('export default [];\n', [['a', 'b']]);

    expect(String(error)).toContain('contextRelations');
  });
});
