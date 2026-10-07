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
  const withTarget = project.replace(
    /\n\}\n$/,
    `,\n  "targets": {\n${testTarget(dir)}\n  }\n}\n`,
  );
  if (withTarget === project)
    throw new Error(
      `could not add the test target to ${dir}/project.json: expected it to end with a closing brace and a newline`,
    );
  return withTarget;
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

const noDuplicates = <T extends { name: string }>(
  items: T[],
  label: string,
): T[] => {
  const seen = new Set<string>();
  for (const { name } of items) {
    if (seen.has(name)) throw new Error(`${label} ${name} is listed twice`);
    seen.add(name);
  }
  return items;
};

const PRIMITIVES = new Set(['string', 'number', 'boolean']);
const TYPE = /^(string|number|boolean|[A-Z][A-Za-z0-9]*)(\[\])?$/;

/** The element type of a `T` or `T[]` annotation. */
const elementType = (type: string): string => type.replace(/\[\]$/, '');

/** `label:string,lines:OrderLine[]` → [{ name, type }]; a PascalCase type needs the caller's `type_import`. */
export const parseInputs = (
  spec: string,
): Array<{ name: string; type: string }> =>
  noDuplicates(
    spec
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name = '', type = ''] = part.split(':').map((s) => s.trim());
        if (!/^[a-z][A-Za-z0-9]*$/.test(name))
          throw new Error(`input "${name}" must be camelCase`);
        if (!TYPE.test(type)) {
          throw new Error(
            `input ${name} has type "${type}": use string, number, boolean or a PascalCase type (with type_import)`,
          );
        }
        return { name, type };
      }),
    'input',
  );

/** `added:AddLine,placed` → [{ name, type? }]; a bare name is an output without payload. */
export const parseOutputs = (
  spec: string,
): Array<{ name: string; type?: string }> =>
  noDuplicates(
    spec
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name = '', type] = part.split(':').map((s) => s.trim());
        if (!/^[a-z][A-Za-z0-9]*$/.test(name))
          throw new Error(`output "${name}" must be camelCase`);
        if (type !== undefined && !TYPE.test(type)) {
          throw new Error(
            `output ${name} has type "${type}": use string, number, boolean or a PascalCase type (with type_import)`,
          );
        }
        return type === undefined ? { name } : { name, type };
      }),
    'output',
  );

/** The PascalCase types a component imports, sorted and unique. */
export const customTypes = (types: string[]): string[] =>
  [
    ...new Set(types.map(elementType).filter((type) => !PRIMITIVES.has(type))),
  ].sort();

/** The class a name gives: order-card → OrderCard. */
export const className = (name: string): string => pascal(name);
