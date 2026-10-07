import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  contractTokens,
  typeProps,
} from '../../libs/web/shared/design-system/src/tokens/contract';

const THEMES_DIR = 'libs/web/shared/design-system/themes';
const OUTPUT = 'libs/web/shared/design-system/src/styles/themes.generated.css';
const DEFAULT_THEME = 'shopify';

type Source = { path: string } | { literal: string };
type Mapping = Record<string, Source>;
export interface Theme {
  name: string;
  vars: Record<string, string>;
}

const typeSource = {
  family: 'fontFamily',
  size: 'fontSize',
  weight: 'fontWeight',
  'line-height': 'lineHeight',
  'letter-spacing': 'letterSpacing',
} as const satisfies Record<(typeof typeProps)[number], string>;

function lookup(frontmatter: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      frontmatter,
    );
}

function scalar(value: unknown, where: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${where} is not a scalar`);
  }
  return String(value);
}

export function resolveTheme(
  frontmatter: unknown,
  mapping: Mapping,
  tokens: readonly string[] = contractTokens,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const token of tokens) {
    const source = mapping[token];
    if (!source) throw new Error(`mapping misses contract token ${token}`);
    const value =
      'literal' in source ? source.literal : lookup(frontmatter, source.path);
    if (value === undefined)
      throw new Error(
        `${token}: path ${'path' in source ? source.path : ''} does not resolve`,
      );

    const [group = '', name = ''] = token.split('.');
    if (group === 'type') {
      for (const prop of typeProps) {
        vars[`--ds-type-${name}-${prop}`] = scalar(
          lookup(value, typeSource[prop]),
          `${token}.${prop}`,
        );
      }
    } else {
      vars[`--ds-${group}-${name}`] = scalar(value, token);
    }
  }
  return vars;
}

export function renderCss(themes: Theme[], defaultTheme: string): string {
  return themes
    .map(({ name, vars }) => {
      const selector =
        name === defaultTheme
          ? `:root,\n[data-theme="${name}"]`
          : `[data-theme="${name}"]`;
      const body = Object.entries(vars)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');
      return `${selector} {\n${body}\n}\n`;
    })
    .join('\n');
}

export function loadThemes(): Theme[] {
  return readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => {
      const markdown = readFileSync(
        join(THEMES_DIR, name, 'DESIGN.md'),
        'utf8',
      );
      const frontmatter: unknown = parse(
        /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? '',
      );
      const mapping = parse(
        readFileSync(join(THEMES_DIR, name, 'mapping.yaml'), 'utf8'),
      ) as Mapping;
      return { name, vars: resolveTheme(frontmatter, mapping) };
    });
}

if (import.meta.main) {
  writeFileSync(OUTPUT, renderCss(loadThemes(), DEFAULT_THEME));
}
