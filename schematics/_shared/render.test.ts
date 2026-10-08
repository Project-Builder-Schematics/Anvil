import { describe, expect, it } from 'bun:test';
import { parse, render } from './render.ts';

describe('render', () => {
  it('prints a string, number or boolean option and leaves other text as it is', () => {
    expect(
      render('a {= .name =}, {= .n =}, {= .on =}.\n', {
        name: 'x',
        n: 422,
        on: false,
      }),
    ).toBe('a x, 422, false.\n');
  });

  it('prints a dotted field of an object option', () => {
    expect(render('{= .a.b =}', { a: '{"b": "deep"}' })).toBe('deep');
  });

  it('repeats a range for each item, with `.` the item or `.field` its field', () => {
    expect(
      render('{= range .rows =}{= .code =}={= .status =};\n{= end =}', {
        rows: [
          { code: 'A', status: 1 },
          { code: 'B', status: 2 },
        ],
      }),
    ).toBe('A=1;\nB=2;\n');
    expect(
      render('{= range .xs =}<{= . =}>{= end =}', { xs: ['p', 'q'] }),
    ).toBe('<p><q>');
    expect(render('[{= range .xs =}x{= end =}]', { xs: [] })).toBe('[]');
  });

  it('reads a list the way the engine receives it, as JSON text', () => {
    expect(render('{= range .xs =}{= . =}{= end =}', { xs: '["a","b"]' })).toBe(
      'ab',
    );
  });

  it('writes a literal, the way to put `{=` into a file', () => {
    expect(render('a {= "{=" =} b', {})).toBe('a {= b');
  });

  it('trims the whitespace around an action with the dash markers', () => {
    expect(render('a \n{=- .x -=}\n b', { x: '1' })).toBe('a1b');
    expect(render('a {= .x =} {=- .x =} b', { x: '1' })).toBe('a 11 b');
  });

  it('does not decode text that is not JSON, nor text that merely starts like it', () => {
    expect(render('{= .t =}', { t: '[draft] note' })).toBe('[draft] note');
  });

  it('refuses to print a text the engine would decode into a list or a map', () => {
    expect(() => render('{= .t =}', { t: '{}' })).toThrow('cannot be printed');
    expect(() => render('{= .t =}', { t: '["a", "b"]' })).toThrow(
      'a list and cannot be printed',
    );
  });

  it('refuses a missing option, as the engine does', () => {
    expect(() => render('{= .nope =}', {})).toThrow('no entry for key "nope"');
  });

  it('refuses ranging over something that is not a list', () => {
    expect(() => render('{= range .s =}{= end =}', { s: 'x' })).toThrow(
      'not a list',
    );
  });

  it('refuses every construct beyond the subset', () => {
    for (const action of [
      'if .on',
      '.name | upper',
      'else',
      'with .a',
      '$.name',
      'len .xs',
      'range',
    ])
      expect(() => parse(`{= ${action} =}`)).toThrow('unsupported action');
    expect(() => parse('{= end =}')).toThrow('without a range');
    expect(() => parse('{= range .xs =}')).toThrow('not closed');
    expect(() => parse('{= .x')).toThrow('unclosed');
  });
});
