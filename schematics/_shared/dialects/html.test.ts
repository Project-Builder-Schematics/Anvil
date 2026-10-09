import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Element } from '@angular/compiler';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import { html } from './html.ts';

const repo = resolve(import.meta.dir, '../../..');
const templates = [...new Bun.Glob('{apps,libs}/**/*.html').scanSync(repo)];

const edit = (
  source: string,
  change: (ast: ReturnType<typeof html.ast.parse>) => void,
) =>
  runFactoryForTest(
    async () => {
      await html.find('t.html').modify(change);
    },
    {} as never,
    { seed: { 't.html': source } },
  );

describe('the html dialect', () => {
  it('handles .html files', () => {
    expect(html.extensions).toEqual(['.html']);
  });

  it('round-trips every template of the repo byte for byte', () => {
    expect(templates.length).toBeGreaterThan(5);
    for (const path of templates) {
      const source = readFileSync(resolve(repo, path), 'utf8');
      const ast = html.ast.parse(source);

      expect(ast.nodes.length).toBeGreaterThan(0);
      expect(html.ast.print(ast)).toBe(source);
    }
  });

  it('round-trips control flow, ICU expansions, CRLF line ends and a BOM', () => {
    const source =
      '﻿@if (items.length) {\r\n  <p>{count, plural, =0 {none} =1 {one} other {many}}</p>\r\n} @else {\r\n  <p  class="empty" >none</p>\r\n}\r\n';

    expect(html.ast.print(html.ast.parse(source))).toBe(source);
  });

  it('refuses a template the angular parser reports errors for', () => {
    expect(() => html.ast.parse('<div></span>')).toThrow();
  });

  it('applies splices over the original source and leaves the rest as it was', async () => {
    const source = '<ul>\n  <li class="a">one</li>\n  <li>two</li>\n</ul>\n';
    const { error, tree } = await edit(source, (ast) => {
      const [list] = ast.nodes;
      const first =
        list instanceof Element
          ? list.children.find((child) => child instanceof Element)
          : undefined;
      const at = (first as Element).endSourceSpan?.end.offset ?? 0;
      ast.splice(at, at, '<!-- after one -->');
    });

    expect(error).toBeUndefined();
    expect(tree.get('t.html')).toBe(
      '<ul>\n  <li class="a">one</li><!-- after one -->\n  <li>two</li>\n</ul>\n',
    );
  });

  it('applies splices in source order whatever order they were made in', () => {
    const ast = html.ast.parse('abcdef');
    ast.splice(4, 5, 'E');
    ast.splice(1, 2, 'B');

    expect(html.ast.print(ast)).toBe('aBcdEf');
  });

  it('refuses overlapping splices and ranges outside the source', () => {
    const overlapping = html.ast.parse('abcdef');
    overlapping.splice(1, 4, 'x');
    overlapping.splice(3, 5, 'y');

    expect(() => html.ast.print(overlapping)).toThrow('overlap');
    expect(() => {
      html.ast.parse('abc').splice(2, 9, '');
    }).toThrow('range');
  });

  it('writes nothing when nothing was spliced', async () => {
    const { error, emitted } = await edit('<p>x</p>\n', () => undefined);

    expect(error).toBeUndefined();
    expect(emitted.flatMap((batch) => batch.instructions)).toEqual([]);
  });
});
