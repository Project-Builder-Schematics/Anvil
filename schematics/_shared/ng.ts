// What the ng-* schematics share: reading the Angular lib they write into, and registering
// the new file in it: its barrel export and the unit-test target an Angular lib needs with
// its first spec.

import { find } from '@pbuilder/sdk/typescript';
import { readRequired, rewrite } from './lib.ts';
import { addReExport, withAst } from './ts.ts';

interface NgLib {
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
export const readNgLib = async (dir: string): Promise<NgLib> => {
  const project = await readRequired(
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

/** Exports a new file of the lib from its barrel and gives the lib its unit-test target. */
export const registerInLib = async (
  lib: NgLib,
  path: string,
): Promise<void> => {
  const barrel = `${lib.dir}/src/index.ts`;
  // web-context and web-shared-lib always write the barrel, so a lib without one is not theirs.
  await readRequired(
    barrel,
    'create the lib first: web-context or web-shared-lib',
  );
  await withAst(find(barrel), (ast) => {
    addReExport(ast, path);
  });
  rewrite(
    `${lib.dir}/project.json`,
    lib.project,
    withTestTarget(lib.project, lib.dir),
  );
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

const parseMembers = (
  spec: string,
  kind: 'input' | 'output',
): Array<{ name: string; type?: string }> =>
  noDuplicates(
    spec
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name = '', type, ...rest] = part.split(':').map((s) => s.trim());
        if (rest.length > 0)
          throw new Error(`${kind} "${part}" has more than one colon`);
        if (!/^[a-z][A-Za-z0-9]*$/.test(name))
          throw new Error(`${kind} "${name}" must be camelCase`);
        if (
          kind === 'input'
            ? !TYPE.test(type ?? '')
            : type !== undefined && !TYPE.test(type)
        ) {
          throw new Error(
            `${kind} ${name} has type "${type ?? ''}": use string, number, boolean or a PascalCase type (with type_import)`,
          );
        }
        return type === undefined ? { name } : { name, type };
      }),
    kind,
  );

/** `label:string,lines:OrderLine[]` → [{ name, type }]; a PascalCase type needs the caller's `type_import`. */
export const parseInputs = (
  spec: string,
): Array<{ name: string; type: string }> =>
  parseMembers(spec, 'input').map(({ name, type }) => ({
    name,
    type: type ?? '',
  }));

/** `added:AddLine,placed` → [{ name, type? }]; a bare name is an output without payload. */
export const parseOutputs = (
  spec: string,
): Array<{ name: string; type?: string }> => parseMembers(spec, 'output');

/** The PascalCase types a component imports, sorted and unique. */
export const customTypes = (types: string[]): string[] =>
  [
    ...new Set(types.map(elementType).filter((type) => !PRIMITIVES.has(type))),
  ].sort();
