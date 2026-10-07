// Pending quickpickle step definitions from a feature's phrases.

interface Phrase {
  keyword: 'Given' | 'When' | 'Then';
  text: string;
  /** Cucumber expression: quoted strings become {string}, bare integers {int}. */
  expression: string;
  params: string[];
}

/** Every distinct step of a feature, in order; And/But take the keyword of the step before them. */
export const phrases = (feature: string): Phrase[] => {
  const seen = new Map<string, Phrase>();
  let keyword: Phrase['keyword'] = 'Given';
  let inDocString = false;
  const lines = feature.split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('"""')) inDocString = !inDocString;
    if (inDocString) return;
    const m = /^(Given|When|Then|And|But|\*)\s+(.+)$/.exec(line);
    const text = m?.[2];
    if (!m || text === undefined) return;
    if (m[1] === 'Given' || m[1] === 'When' || m[1] === 'Then') keyword = m[1];
    const params: string[] = [];
    // One pass, so a digit inside a quoted string is part of the string and an escape never meets a parameter.
    const expression = text.replace(
      /"[^"]*"|(?<![\w{])-?\d+(?![\w}])|[\\(){}/]/g,
      (token) => {
        if (token.startsWith('"')) {
          params.push(`arg${String(params.length)}: string`);
          return '{string}';
        }
        if (/^-?\d/.test(token)) {
          params.push(`arg${String(params.length)}: number`);
          return '{int}';
        }
        return `\\${token}`;
      },
    );
    if (lines[i + 1]?.trim().startsWith('|')) params.push('table: DataTable');
    if (!seen.has(expression))
      seen.set(expression, { keyword, text, expression, params });
  });
  return [...seen.values()];
};

/** The expression as a single-quoted TypeScript literal. */
const literal = (p: Phrase): string =>
  `'${p.expression.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export const binding = (p: Phrase): string =>
  `${p.keyword}(${literal(p)}, ${p.params.length ? `(_world, ${p.params.join(', ')}) ` : '() '}=> 'skipped');`;

const bound = (siblings: string[], p: Phrase): boolean =>
  siblings.some((source) => source.includes(literal(p)));

/** The steps file of one use case: a pending binding per phrase no sibling file binds yet. */
export const stepsSource = (feature: string, siblings: string[]): string => {
  const own = phrases(feature).filter((p) => !bound(siblings, p));
  if (own.length === 0) return 'export {};\n';
  const keywords = [...new Set(own.map((p) => p.keyword))].sort();
  const table = own.some((p) => p.params.includes('table: DataTable'))
    ? ['type DataTable']
    : [];
  return `/* eslint-disable @typescript-eslint/no-unused-vars -- pending bindings keep their arguments until the scenarios are implemented */
import { ${[...keywords, ...table].join(', ')} } from 'quickpickle';

${own.map(binding).join('\n\n')}
`;
};
