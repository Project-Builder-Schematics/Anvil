import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from './render.ts';

// Every new file is rendered from a template in the folder of the schematic that runs, since the
// engine reads templates from that one package only. These tests keep the templates dumb, keep
// every file a factory names there, and keep a schematic that runs other factories in step with
// the template folders they use.

const root = resolve(import.meta.dir, '..');
const read = (path: string): string => readFileSync(path, 'utf8');

const schematics = readdirSync(root).filter(
  (name) => !name.startsWith('_') && existsSync(join(root, name, 'factory.ts')),
);

/** Files below a directory, following symlinked folders as the engine does. */
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

const named = (schematic: string): string[] =>
  [
    ...read(join(root, schematic, 'factory.ts')).matchAll(/'(files\/[^']+)'/g),
  ].map((match) => match[1] ?? '');

const sources = [
  ...schematics.map((name) => join(root, name, 'factory.ts')),
  ...readdirSync(join(root, '_shared'))
    .filter(
      (name) =>
        /\.ts$/.test(name) && !/\.test\.ts$|^(testing|render)\.ts$/.test(name),
    )
    .map((name) => join(root, '_shared', name)),
];

describe('templates', () => {
  it('use only interpolation, range and literals, which is all the tests can render', () => {
    const templates = schematics.flatMap((name) => {
      const dir = join(root, name, 'files');
      return existsSync(dir) ? filesUnder(dir) : [];
    });

    expect(templates.length).toBeGreaterThan(30);
    for (const path of templates) {
      expect(path).toEndWith('.template');
      expect(() => parse(read(path))).not.toThrow();
    }
  });

  it('are the only way a factory writes a new file: no inline template and no escape helper', () => {
    for (const path of sources) {
      const source = read(path);
      expect([path, /\btemplate:/.test(source)]).toEqual([path, false]);
      expect([path, source.includes('createFile')]).toEqual([path, false]);
    }
  });

  it.each(schematics)('are all there in the folder of %s', (schematic) => {
    for (const path of named(schematic))
      expect(existsSync(join(root, schematic, path))).toBe(true);
  });

  it.each(schematics)(
    'of every factory %s runs are in its own folder too',
    (schematic) => {
      const calls = [
        ...read(join(root, schematic, 'factory.ts')).matchAll(
          /from '\.\.\/([a-z-]+)\/factory\.ts'/g,
        ),
      ].map((match) => match[1] ?? '');
      for (const callee of calls) {
        for (const path of named(callee))
          expect(existsSync(join(root, schematic, path))).toBe(true);
      }
    },
  );
});
