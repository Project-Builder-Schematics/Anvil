// Shared by the hex-* and web/ng-* schematics: naming, workspace layout, the
// domain-model.md readers, and the text edits generators make to existing files.

import { create, find, replaceContent } from '@pbuilder/sdk/commons';

/**
 * The engine accepts one write directive per path per run: a second `replaceContent`
 * on a file comes back as `path-collision`. One hex-subdomain run calls the leaf
 * factories once per use case and once per route, and several of those calls land on
 * the same files (the context barrel, the module, a controller). They read and write
 * through this buffer instead, and the run emits one directive per path when it flushes.
 */
export interface WriteBuffer {
  read(path: string): Promise<string | undefined>;
  readRequired(path: string, hint: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  flush(): void;
}

/** `create` renders its content as a template; the opening delimiter is written as a literal so the file holds what it was given, as `replaceContent` does. */
export const createFile = (path: string, content: string): void => {
  create(path, {
    template: content.replaceAll('{=', '{= "{=" =}'),
    options: {},
  });
};

export const writeBuffer = (): WriteBuffer => {
  // What the path held before the run touched it: decides create vs replaceContent.
  const original = new Map<string, string | undefined>();
  const pending = new Map<string, string>();

  const source = async (path: string): Promise<string | undefined> => {
    const content = await find(path).read();
    if (!original.has(path)) original.set(path, content);
    return content;
  };

  const read = async (path: string): Promise<string | undefined> =>
    pending.has(path) ? pending.get(path) : source(path);

  return {
    read,
    readRequired: async (path, hint) => {
      const content = await read(path);
      if (content === undefined) throw new Error(`${path} not found — ${hint}`);
      return content;
    },
    write: async (path, content) => {
      await source(path);
      pending.set(path, content);
    },
    flush: () => {
      for (const [path, content] of pending) {
        const before = original.get(path);
        if (content === before) continue;
        if (before === undefined) createFile(path, content);
        else replaceContent(path, content);
      }
      pending.clear();
      original.clear();
    },
  };
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

/** "CreateOrder" → "create-order" */
export const dashed = (pascalCase: string): string =>
  pascalCase.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** "CreateOrder" → "Create order" */
export const sentence = (pascalCase: string): string => {
  const words = pascalCase.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return (words[0] ?? '').toUpperCase() + words.slice(1);
};

/** "order-items" → "Order items" */
export const title = (dashedCase: string): string => {
  const words = dashedCase.replace(/-/g, ' ');
  return (words[0] ?? '').toUpperCase() + words.slice(1);
};

/** How a context relates to the one it depends on; the Context map table of a README uses these words. */
export const RELATIONSHIPS = ['customer-supplier', 'conformist', 'acl'];

export const SCOPE = '@demo';
export const TSCONFIG_BASE = 'tsconfig.base.json';
export const ESLINT_CONFIG = 'eslint.config.mjs';
export const DOMAIN_MODEL = 'domain-model.md';

export const apiLibDir = (context: string): string => `libs/api/${context}`;
export const apiAlias = (context: string): string => `${SCOPE}/api-${context}`;
export const docsDir = (context: string): string => `docs/${context}`;

export interface SlicePaths {
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
  buffer: WriteBuffer,
): Promise<SlicePaths> => {
  const docs = docsDir(context);
  const src = `${apiLibDir(context)}/src`;
  if ((await buffer.read(`${docs}/${slice}/${DOMAIN_MODEL}`)) !== undefined) {
    return {
      code: `${src}/${slice}`,
      docs: `${docs}/${slice}`,
      segment: `${slice}/`,
    };
  }
  const readme = await buffer.read(`${docs}/README.md`);
  const inline = (await buffer.read(`${docs}/${DOMAIN_MODEL}`)) !== undefined;
  if (
    inline &&
    readme !== undefined &&
    new RegExp(`^\\|\\s*(\\[${slice}\\]\\(|${slice}\\s*\\|)`, 'm').test(readme)
  ) {
    return { code: src, docs, segment: '' };
  }
  throw new Error(
    `${slice} has no domain model under ${docs} — write the docs first: hex-bounded-context --context=${context} --subdomains=…,${slice}`,
  );
};

// --- Reading the domain model: tables under a verbatim `## heading`, cells split
// on unescaped pipes, backticks stripped; numbered rules; error codes as CAPS tokens.

export const strip = (cell: string): string =>
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

/** `| 1 | text | Source |` rows → rules[1] = "text", backticks intact for `errorCodes`. */
export const numberedRules = (model: string): Map<number, string> =>
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

// --- Text edits to existing files.

export const EMPTY_MODULE = 'export {};\n';

/** Adds import lines after the last existing import (or at the top); skips ones already present. */
export const withImports = (source: string, importLines: string[]): string => {
  const base = source === EMPTY_MODULE ? '' : source;
  const missing = importLines.filter((line) => !base.includes(line));
  if (missing.length === 0) return base;

  const lines = base.split('\n');
  let last = -1;
  lines.forEach((line, i) => {
    if (/^import\s/.test(line)) last = i;
  });
  // An import ends on the line holding its module string: `from '…'`, or the bare `'…'` of a side-effect import.
  while (
    last >= 0 &&
    !/['"][^'"]+['"];?\s*$/.test(lines[last] ?? '') &&
    last < lines.length - 1
  )
    last += 1;

  if (last === -1) return `${missing.join('\n')}\n${base ? `\n${base}` : ''}`;
  lines.splice(last + 1, 0, ...missing);
  return lines.join('\n');
};

/** Appends a statement at the end of a module; skips it when already present. */
export const withStatement = (source: string, statement: string): string => {
  const base = source === EMPTY_MODULE ? '' : source;
  if (base.includes(statement)) return base;
  const body = base.replace(/\n+$/, '');
  return `${body}${body ? '\n\n' : ''}${statement}\n`;
};

/** Adds names to the `import { … } from '<from>'` line, creating it when absent. */
export const withNamedImports = (
  source: string,
  from: string,
  names: string[],
): string => {
  const pattern = new RegExp(
    `^import \\{([^}]*)\\} from '${from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}';$`,
    'm',
  );
  const existing = pattern.exec(source);
  const merged = [
    ...new Set([
      ...(existing?.[1] ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
      ...names,
    ]),
  ].sort();
  const line = `import { ${merged.join(', ')} } from '${from}';`;
  return existing ? source.replace(pattern, line) : withImports(source, [line]);
};

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

/** Registers a bounded context in the root lint config's `contexts` list, which feeds the module-boundary constraints. */
export const addLintContext = (config: string, context: string): string => {
  const list = /const contexts = \[([\s\S]*?)\];/.exec(config);
  if (!list)
    throw new Error(
      'eslint.config.mjs has no `const contexts = [...]` list to extend',
    );
  const names = [...(list[1] ?? '').matchAll(/'([^']+)'/g)].map(
    (m) => m[1] ?? '',
  );
  if (names.includes(context)) return config;
  const items = [...names, context].map((name) => `  '${name}',`).join('\n');
  return config.replace(list[0], `const contexts = [\n${items}\n];`);
};

/** The `[…]` assigned to `const <name> =`: its span in the config, `;` included, and the text between the brackets. */
const arrayLiteral = (
  config: string,
  name: string,
): { start: number; end: number; inner: string } | undefined => {
  const head = new RegExp(`const ${name} = \\[`).exec(config);
  if (!head) return undefined;
  const open = head.index + head[0].length - 1;
  const skipTo = (token: string, from: number): number => {
    const at = config.indexOf(token, from);
    return at === -1 ? config.length : at + token.length - 1;
  };
  let depth = 0;
  for (let i = open; i < config.length; i += 1) {
    const c = config[i] ?? '';
    if (c === "'" || c === '"') i = skipTo(c, i + 1);
    else if (config.startsWith('//', i)) i = skipTo('\n', i);
    else if (config.startsWith('/*', i)) i = skipTo('*/', i + 2);
    else if (c === '[') depth += 1;
    else if (c === ']' && (depth -= 1) === 0)
      return {
        start: head.index,
        end: config[i + 1] === ';' ? i + 2 : i + 1,
        inner: config.slice(open + 1, i),
      };
  }
  return undefined;
};

const NAME_PAIR = /\[\s*(['"])([^'"]+)\1\s*,\s*(['"])([^'"]+)\3\s*,?\s*\]/g;

/** Declares in the root lint config that `from` may depend on `to`'s barrel; the module-boundary constraints are built from this list. */
export const addContextRelation = (
  config: string,
  from: string,
  to: string,
): string => {
  const list = arrayLiteral(config, 'contextRelations');
  if (!list)
    throw new Error(
      'eslint.config.mjs has no `const contextRelations = [...]` list to extend',
    );
  const inner = list.inner.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  if (inner.replace(NAME_PAIR, '').replace(/[\s,]/g, '') !== '')
    throw new Error(
      "contextRelations has an entry that is not a ['from', 'to'] pair of names",
    );
  const edges = [...inner.matchAll(NAME_PAIR)].map(
    (m) => [m[2] ?? '', m[4] ?? ''] as const,
  );
  if (edges.some(([a, b]) => a === from && b === to)) return config;
  const items = [...edges, [from, to]]
    .map(([a, b]) => `  ['${a}', '${b}'],`)
    .join('\n');
  return `${config.slice(0, list.start)}const contextRelations = [\n${items}\n];${config.slice(list.end)}`;
};

// --- Nest module metadata: `@Module({ imports, controllers, providers, exports })`.

const MODULE_KEYS = ['imports', 'controllers', 'providers', 'exports'] as const;
type ModuleKey = (typeof MODULE_KEYS)[number];

/** Splits `text` on commas that are not nested in brackets or strings. */
const splitTopLevel = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] ?? '';
    if (quote) {
      if (c === quote && text[i - 1] !== '\\') quote = '';
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
};

const squash = (text: string): string => text.replace(/\s+/g, '');

/** Adds `entry` to one array of the file's `@Module({…})` metadata; the metadata is re-rendered in a fixed key order. */
export const addModuleEntry = (
  source: string,
  key: ModuleKey,
  entry: string,
): string => {
  const open = source.indexOf('@Module({');
  if (open === -1) throw new Error('no @Module({…}) decorator to extend');
  const bodyStart = open + '@Module({'.length;
  let depth = 1;
  let end = bodyStart;
  for (; end < source.length && depth > 0; end += 1) {
    if (source[end] === '{') depth += 1;
    if (source[end] === '}') depth -= 1;
  }
  const body = source.slice(bodyStart, end - 1);

  const arrays = new Map<string, string[]>();
  const rest: string[] = [];
  for (const prop of splitTopLevel(body)) {
    const m = /^(\w+)\s*:\s*\[([\s\S]*)\]$/.exec(prop);
    if (m) arrays.set(m[1] ?? '', splitTopLevel(m[2] ?? ''));
    else rest.push(prop);
  }
  const items = arrays.get(key) ?? [];
  if (!items.some((item) => squash(item) === squash(entry))) items.push(entry);
  arrays.set(key, items);

  const render = (name: string, values: string[]): string => {
    const inline = `  ${name}: [${values.join(', ')}],`;
    return inline.length <= 80
      ? inline
      : `  ${name}: [\n${values.map((v) => `    ${v},`).join('\n')}\n  ],`;
  };
  const lines = [
    ...MODULE_KEYS.filter((k) => arrays.has(k)).map((k) =>
      render(k, arrays.get(k) ?? []),
    ),
    ...[...arrays]
      .filter(([k]) => !(MODULE_KEYS as readonly string[]).includes(k))
      .map(([k, v]) => render(k, v)),
    ...rest.map((r) => `  ${r},`),
  ];
  return `${source.slice(0, bodyStart)}\n${lines.join('\n')}\n${source.slice(end - 1)}`;
};
