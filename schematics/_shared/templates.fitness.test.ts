import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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

/** The files a named path stands for: the path itself, or every file below it when it is a folder. */
const expand = (schematic: string, path: string): string[] => {
  const absolute = join(root, schematic, path);
  return statSync(absolute).isDirectory()
    ? filesUnder(absolute).map((file) => relative(join(root, schematic), file))
    : [path];
};

/** Every schematic whose factory a schematic runs, directly or through another. */
const callees = (schematic: string): string[] => {
  const direct = [
    ...read(join(root, schematic, 'factory.ts')).matchAll(
      /from '\.\.\/([a-z-]+)\/factory\.ts'/g,
    ),
  ].map((match) => match[1] ?? '');
  return [...new Set(direct.flatMap((name) => [name, ...callees(name)]))];
};

// A template that is created inline: `template: …`, a `template` shorthand or a quoted key.
const INLINE_TEMPLATE = /(?<![.\w])template(?!\w)/;

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
      expect([path, INLINE_TEMPLATE.test(source)]).toEqual([path, false]);
      expect([path, source.includes('createFile')]).toEqual([path, false]);
    }
  });

  it.each(schematics)('are all there in the folder of %s', (schematic) => {
    const paths = named(schematic);
    // The pattern reads quoted paths: a factory that names its templates another way would pass vacuously.
    expect(paths.length > 0).toBe(
      /templateFile|scaffold\(/.test(read(join(root, schematic, 'factory.ts'))),
    );
    for (const path of paths)
      expect(existsSync(join(root, schematic, path))).toBe(true);
  });

  it.each(schematics)(
    'of every factory %s runs, directly or not, are in its own folder too',
    (schematic) => {
      for (const callee of callees(schematic)) {
        for (const path of named(callee))
          for (const file of expand(callee, path))
            expect(existsSync(join(root, schematic, file))).toBe(true);
      }
    },
  );

  it('are never read through a symlink below a folder that scaffold walks, which it skips', () => {
    for (const schematic of schematics) {
      for (const path of named(schematic)) {
        const absolute = join(root, schematic, path);
        if (!statSync(absolute).isDirectory()) continue;
        const links = readdirSync(absolute, {
          recursive: true,
          withFileTypes: true,
        }).filter((entry) => entry.isSymbolicLink());
        expect(links.map((entry) => entry.name)).toEqual([]);
      }
    }
  });

  it('are named by a pattern that finds them, and an inline template by one that sees its forms', () => {
    expect(schematics.flatMap(named).length).toBeGreaterThan(20);
    for (const inline of [
      'create(p, { template: x })',
      'create(p, { template })',
      "create(p, { 'template': x })",
      'create(p, { ["template"]: x })',
    ])
      expect(INLINE_TEMPLATE.test(inline)).toBe(true);
    expect(
      INLINE_TEMPLATE.test("{ templateFile: 'files/a.ts.template' }"),
    ).toBe(false);
  });
});
