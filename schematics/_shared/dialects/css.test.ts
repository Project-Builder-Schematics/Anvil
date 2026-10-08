import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import { css } from './css.ts';

const repo = resolve(import.meta.dir, '../../..');
const sheets = [...new Bun.Glob('{apps,libs}/**/*.css').scanSync(repo)];

const edit = (
  source: string,
  change: (root: ReturnType<typeof css.ast.parse>) => void,
) =>
  runFactoryForTest(
    async () => {
      await css.find('t.css').modify(change);
    },
    {} as never,
    { seed: { 't.css': source } },
  );

describe('the css dialect', () => {
  it('handles .css files', () => {
    expect(css.extensions).toEqual(['.css']);
  });

  it('round-trips every stylesheet of the repo byte for byte', () => {
    expect(sheets.length).toBeGreaterThan(5);
    for (const path of sheets) {
      const source = readFileSync(resolve(repo, path), 'utf8');

      expect(css.ast.print(css.ast.parse(source))).toBe(source);
    }
  });

  it('round-trips comments, odd spacing, nesting, custom properties and CRLF line ends', () => {
    const source =
      ':root{--gap : 4px ;}\r\n/* keep  me */\r\n.a   >  .b{ color:red;\r\n  &:hover { color : blue }\r\n}\r\n@media (min-width:600px){.c{margin:0 auto}}\r\n';

    expect(css.ast.print(css.ast.parse(source))).toBe(source);
  });

  it('refuses a stylesheet postcss cannot parse', () => {
    expect(() => css.ast.parse('.a { color: red;')).toThrow();
  });

  it('edits through postcss and leaves the rest of the file as it was', async () => {
    const source = '/* head */\n.a   { color:red }\n\n.b{margin:0}\n';
    const { error, tree } = await edit(source, (root) => {
      root.walkRules('.b', (rule) => {
        rule.append({ prop: 'padding', value: '0' });
      });
    });

    expect(error).toBeUndefined();
    expect(tree.get('t.css')).toBe(
      '/* head */\n.a   { color:red }\n\n.b{margin:0;padding:0}\n',
    );
  });

  it('writes nothing when nothing changed', async () => {
    const { error, emitted } = await edit(
      '.a { color: red }\n',
      () => undefined,
    );

    expect(error).toBeUndefined();
    expect(emitted.flatMap((batch) => batch.instructions)).toEqual([]);
  });
});
