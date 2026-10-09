// Shared by the hex-* and web/ng-* schematics: naming, workspace layout, the
// domain-model.md readers, and the JSON edits generators make to existing files.

import { find, replaceContent } from '@pbuilder/sdk/commons';

/** Replaces a file's content, unless the edit left it as it was. */
export const rewrite = (path: string, before: string, after: string): void => {
  if (after !== before) replaceContent(path, after);
};

export const readRequired = async (
  path: string,
  hint: string,
): Promise<string> => {
  const content = await find(path).read();
  if (content === undefined) throw new Error(`${path} not found — ${hint}`);
  return content;
};

const DASHED = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;

export const assertDashed = (value: string, label: string): string => {
  if (!DASHED.test(value))
    throw new Error(`${label} "${value}" must be dash-case (e.g. order-items)`);
  return value;
};

export const assertPascal = (value: string, label: string): string => {
  if (!PASCAL.test(value))
    throw new Error(
      `${label} "${value}" must be PascalCase (e.g. CreateOrder)`,
    );
  return value;
};

export const camel = (pascalCase: string): string =>
  (pascalCase[0] ?? '').toLowerCase() + pascalCase.slice(1);

export const pascal = (dashedCase: string): string =>
  dashedCase.replace(/(^|-)(\w)/g, (_m, _s, c: string) => c.toUpperCase());

export const constant = (dashedCase: string): string =>
  dashedCase.replace(/-/g, '_').toUpperCase();

/** The class a slice throws for its refusals: hex-slice writes it and hex-route's filter catches it. */
export const errorClass = (slice: string): string => `${pascal(slice)}Error`;

/** "CreateOrder" → "create-order" */
export const dashed = (pascalCase: string): string =>
  pascalCase.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** "order-items" → "Order items" */
export const title = (dashedCase: string): string => {
  const words = dashedCase.replace(/-/g, ' ');
  return (words[0] ?? '').toUpperCase() + words.slice(1);
};

/** How a context relates to the one it depends on; the Context map table of a README uses these words. */
export const RELATIONSHIPS = ['customer-supplier', 'conformist', 'acl'];

export const SCOPE = '@anvil';
export const TSCONFIG_BASE = 'tsconfig.base.json';
export const ESLINT_CONFIG = 'eslint.config.mjs';
export const DOMAIN_MODEL = 'domain-model.md';

export const apiLibDir = (context: string): string => `libs/api/${context}`;
export const apiAlias = (context: string): string => `${SCOPE}/api-${context}`;
export const docsDir = (context: string): string => `docs/${context}`;

interface SlicePaths {
  /** Where the slice's code lives. */
  code: string;
  /** Where its domain model and features live. */
  docs: string;
  /** Path segment between the lib's src and the slice: "" when inline, "<slice>/" when nested. */
  segment: string;
}

/**
 * Code and docs mirror each other: a context with one subdomain keeps both inline in
 * the lib's src, one with several keeps a folder per subdomain. The docs decide, and
 * they are written first: no domain model, no slice.
 */
export const resolveSlice = async (
  context: string,
  slice: string,
): Promise<SlicePaths> => {
  const docs = docsDir(context);
  const src = `${apiLibDir(context)}/src`;
  if ((await find(`${docs}/${slice}/${DOMAIN_MODEL}`).read()) !== undefined) {
    return {
      code: `${src}/${slice}`,
      docs: `${docs}/${slice}`,
      segment: `${slice}/`,
    };
  }
  const readme = await find(`${docs}/README.md`).read();
  const inline = (await find(`${docs}/${DOMAIN_MODEL}`).read()) !== undefined;
  if (inline && readme !== undefined && subdomainNames(readme).includes(slice))
    return { code: src, docs, segment: '' };
  throw new Error(
    `${slice} has no domain model under ${docs}${inline ? ` (${docs}/README.md does not list ${slice} under "## Subdomains")` : ''} — write the docs first: hex-bounded-context --context=${context} --subdomains=…,${slice}`,
  );
};

// --- Reading the domain model: tables under a verbatim `## heading`, cells split
// on unescaped pipes, backticks stripped; numbered rules; error codes as CAPS tokens.

const strip = (cell: string): string =>
  cell.replace(/`/g, '').replace(/\\\|/g, '|').trim();

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map(strip);

const section = (model: string, heading: string): string =>
  model.split(new RegExp(`^## ${heading}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ??
  '';

/** Data rows of the table under `## heading` (header and separator skipped). */
export const table = (model: string, heading: string): string[][] =>
  section(model, heading)
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2)
    .map(cells);

/** The row whose first cell is `first`, or undefined. */
export const row = (
  model: string,
  heading: string,
  first: string,
): string[] | undefined => table(model, heading).find((r) => r[0] === first);

/** The subdomains of a README's Subdomains table: the name of a `[name](link)` or a bare `name`. */
export const subdomainNames = (readme: string): string[] =>
  table(readme, 'Subdomains').map(
    ([cell = '']) => /^\[([^\]]+)\]/.exec(cell)?.[1] ?? cell,
  );

/** `| 1 | text | Source |` rows → rules[1] = "text", backticks intact for `errorCodes`. */
const numberedRules = (model: string): Map<number, string> =>
  new Map(
    [
      ...section(model, 'Business rules').matchAll(
        /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|[^|]*\|\s*$/gm,
      ),
    ].map((m) => [Number(m[1]), m[2] ?? '']),
  );

const CODE = /`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g;

/** Error codes the business rules name, in order of first appearance. */
export const errorCodes = (model: string): string[] => {
  const codes = new Set<string>();
  for (const text of numberedRules(model).values()) {
    for (const m of text.matchAll(CODE)) codes.add(m[1] ?? '');
  }
  return [...codes];
};

/** Rule numbers of a citation: "2–3, 5" → [2, 3, 5]. */
const citedRules = (list: string): number[] =>
  list.split(',').flatMap((part) => {
    const range = /^\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*$/.exec(part);
    if (!range)
      throw new Error(
        `"${part.trim()}" is not a rule number or a range such as 2–3`,
      );
    const from = Number(range[1]);
    const to = Number(range[2] ?? from);
    if (to < from)
      throw new Error(`"${part.trim()}" is a range that ends before it starts`);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });

/**
 * Error code → HTTP status, from the Driving adapters `Answers` cells: `422 rules 2–3`
 * gives the codes the business rules 2 and 3 name that status. A cell lists its statuses
 * separated by `·`.
 */
export const errorStatuses = (model: string): Map<string, number> => {
  const rules = numberedRules(model);
  const statuses = new Map<string, number>();
  for (const [, , answers] of table(model, 'Driving adapters')) {
    for (const answer of (answers ?? '').split('·')) {
      const cited = /^\s*([45]\d\d)\s+rules?\s+(\d[\d\s,–-]*)$/.exec(answer);
      if (!cited) continue;
      const status = Number(cited[1]);
      for (const n of citedRules(cited[2] ?? '')) {
        const rule = rules.get(n);
        if (rule === undefined)
          throw new Error(
            `${String(status)} cites rule ${String(n)}, which is not in the Business rules table`,
          );
        const codes = [...rule.matchAll(CODE)];
        if (codes.length === 0)
          throw new Error(
            `${String(status)} cites rule ${String(n)}, which names no error code`,
          );
        for (const [, code = ''] of codes) {
          const known = statuses.get(code);
          if (known !== undefined && known !== status)
            throw new Error(
              `${code} is answered ${String(known)} and ${String(status)} in the Driving adapters table`,
            );
          statuses.set(code, status);
        }
      }
    }
  }
  return statuses;
};

/** The field names of a command type such as `{ id, lines: Line[], at?: { x: number } }`: the first word of each top-level entry. */
export const commandFields = (command: string): string[] => {
  const inner = command.trim().replace(/^\{|\}$/g, '');
  const fields: string[] = [];
  const take = (from: number, to: number): void => {
    const name = /^\s*([A-Za-z_]\w*)/.exec(inner.slice(from, to))?.[1];
    if (name) fields.push(name);
  };
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i] ?? '';
    if ('{[(<'.includes(c)) depth += 1;
    else if ('}])>'.includes(c) && inner[i - 1] !== '=') depth -= 1;
    else if (c === ',' && depth === 0) {
      take(start, i);
      start = i + 1;
    }
  }
  take(start, inner.length);
  return fields;
};

/** `POST /orders/:id` → { method: "POST", resource: "orders", path: "/:id" } */
export const parseRoute = (
  route: string,
): { method: string; resource: string; path: string } | undefined => {
  const m = /^(GET|POST|PATCH|PUT|DELETE)\s+\/([a-z][a-z0-9-]*)(\/\S*)?$/.exec(
    route,
  );
  return m
    ? { method: m[1] ?? '', resource: m[2] ?? '', path: m[3] ?? '/' }
    : undefined;
};

// --- Edits to JSON files, which have no dialect.

const PATHS_KEY = '"paths"';

/**
 * Registers a path alias in a tsconfig, in prettier's JSON layout. Idempotent: an alias
 * already present is left untouched.
 */
export const addTsPath = (
  tsconfig: string,
  alias: string,
  target: string,
): string => {
  const key = tsconfig.indexOf(PATHS_KEY);
  const open = key === -1 ? -1 : tsconfig.indexOf('{', key);
  if (open === -1) throw new Error(`tsconfig has no "paths" block to extend`);
  let depth = 0;
  let close = open;
  for (; close < tsconfig.length; close += 1) {
    if (tsconfig[close] === '{') depth += 1;
    if (tsconfig[close] === '}' && (depth -= 1) === 0) break;
  }
  const inner = tsconfig.slice(open + 1, close);
  if (inner.includes(`"${alias}":`)) return tsconfig;

  const lineStart = tsconfig.lastIndexOf('\n', key) + 1;
  const closingIndent = /^\s*/.exec(tsconfig.slice(lineStart, key))?.[0] ?? '';
  const indent = `${closingIndent}  `;
  const inline = `${indent}"${alias}": ["${target}"]`;
  const entry =
    inline.length <= 80
      ? inline
      : `${indent}"${alias}": [\n${indent}  "${target}"\n${indent}]`;
  const body =
    inner.trim() === ''
      ? `\n${entry}`
      : `${inner.trimEnd().replace(/,?$/, ',')}\n${entry}`;
  return `${tsconfig.slice(0, open + 1)}${body}\n${closingIndent}${tsconfig.slice(close)}`;
};
