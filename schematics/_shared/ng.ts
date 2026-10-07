// What the ng-* schematics share: reading the Angular lib they write into, the unit-test
// target an Angular lib needs with its first spec, and the barrel export.

import { EMPTY_MODULE, pascal, type WriteBuffer } from './lib.ts';

export interface NgLib {
  dir: string;
  /** Nx project name. */
  name: string;
  /** Selector prefix of the lib. */
  prefix: string;
  /** The type: tag, e.g. "ui". */
  type: string;
  /** project.json as read, for edits. */
  project: string;
}

/** Reads the lib's project.json; a lib without a selector prefix is not an Angular lib. */
export const readNgLib = async (
  buffer: WriteBuffer,
  dir: string,
): Promise<NgLib> => {
  const project = await buffer.readRequired(
    `${dir}/project.json`,
    'create the lib first: web-context or web-shared-lib',
  );
  const parsed = JSON.parse(project) as {
    name?: string;
    prefix?: string;
    tags?: string[];
  };
  if (!parsed.prefix)
    throw new Error(
      `${dir} is not an Angular lib (project.json has no selector prefix)`,
    );
  const type =
    parsed.tags
      ?.find((tag) => tag.startsWith('type:'))
      ?.slice('type:'.length) ?? '';
  return {
    dir,
    name: parsed.name ?? dir,
    prefix: parsed.prefix,
    type,
    project,
  };
};

const testTarget = (dir: string): string => `    "test": {
      "executor": "@angular/build:unit-test",
      "options": {
        "tsConfig": "${dir}/tsconfig.spec.json",
        "buildTarget": "web:build:development",
        "watch": false,
        "coverage": true,
        "coverageExclude": ["**/*.spec.ts", "**/index.ts"],
        "coverageThresholds": {
          "lines": 70,
          "branches": 70,
          "functions": 70,
          "statements": 70
        },
        "coverageInclude": ["${dir}/src/**/*.ts"]
      }
    }`;

/**
 * The Angular unit-test builder fails on a lib with no spec, so an empty lib has no test
 * target; it gets one with its first spec. Returns project.json unchanged when it has one.
 */
export const withTestTarget = (project: string, dir: string): string => {
  const parsed = JSON.parse(project) as { targets?: Record<string, unknown> };
  if (parsed.targets?.['test']) return project;
  if (parsed.targets) {
    parsed.targets['test'] = (
      JSON.parse(`{${testTarget(dir)}}`) as { test: unknown }
    ).test;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  }
  return project.replace(
    /\n\}\n$/,
    `,\n  "targets": {\n${testTarget(dir)}\n  }\n}\n`,
  );
};

/** Appends `export * from` to the barrel, one line per lib file. */
export const withBarrelExport = (
  barrel: string | undefined,
  path: string,
): string => {
  const line = `export * from '${path}';`;
  const body = (
    barrel === undefined || barrel === EMPTY_MODULE ? '' : barrel
  ).replace(/\n+$/, '');
  return body.split('\n').includes(line)
    ? `${body}\n`
    : `${body}${body ? '\n' : ''}${line}\n`;
};

/** `label:string,count:number` → [{ name, type }]; only the types the generated specs can fill. */
export const parseInputs = (
  spec: string,
): Array<{ name: string; type: 'string' | 'number' | 'boolean' }> =>
  spec
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name = '', type = ''] = part.split(':').map((s) => s.trim());
      if (!/^[a-z][A-Za-z0-9]*$/.test(name))
        throw new Error(`input "${name}" must be camelCase`);
      if (type !== 'string' && type !== 'number' && type !== 'boolean') {
        throw new Error(
          `input ${name} has type "${type}": use string, number or boolean`,
        );
      }
      return { name, type };
    });

export const parseNames = (spec: string, label: string): string[] =>
  spec
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => {
      if (!/^[a-z][A-Za-z0-9]*$/.test(name))
        throw new Error(`${label} "${name}" must be camelCase`);
      return name;
    });

/** The class a name gives: order-card → OrderCard. */
export const className = (name: string): string => pascal(name);
