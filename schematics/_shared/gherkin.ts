// Pending quickpickle step definitions from a feature's phrases.

interface Phrase {
  keyword: 'Given' | 'When' | 'Then';
  text: string;
  /** Cucumber expression: quoted strings become {string}, bare integers {int}, decimals {float}. */
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
      /"[^"]*"|(?<![\w{])-?\d+(?:\.\d+)?(?![\w}])|[\\(){}/]/g,
      (token) => {
        if (token.startsWith('"')) {
          params.push(`arg${String(params.length)}: string`);
          return '{string}';
        }
        if (/^-?\d/.test(token)) {
          params.push(`arg${String(params.length)}: number`);
          return token.includes('.') ? '{float}' : '{int}';
        }
        return `\\${token}`;
      },
    );
    if (lines[i + 1]?.trim().startsWith('|')) params.push('table: DataTable');
    if (!seen.has(expression))
      seen.set(expression, { keyword, text, expression, params });
  });
  // {float} also matches an integer; binding both would make quickpickle report an ambiguous step.
  // Phrases that differ only in which numbers are decimals share one binding with every number a {float}.
  const byShape = new Map<string, Phrase>();
  for (const p of seen.values()) {
    const shape = p.expression.replaceAll('{int}', '{float}');
    const kept = byShape.get(shape);
    if (!kept) byShape.set(shape, p);
    else if (shape !== kept.expression)
      byShape.set(shape, { ...kept, expression: shape });
  }
  return [...byShape.values()];
};

const quoted = (text: string): string =>
  `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The expression as a single-quoted TypeScript literal. */
const literal = (p: Phrase): string => quoted(p.expression);

/** quickpickle passes a step that returns "skipped" and fails one that throws, so a pending step throws. */
export const binding = (p: Phrase): string =>
  `${p.keyword}(${literal(p)}, ${p.params.length ? `(_world, ${p.params.join(', ')}) ` : '() '}=> {\n  throw new Error(${quoted(`step not implemented: ${p.text}`)});\n});`;

const bound = (siblings: string[], p: Phrase): boolean =>
  siblings.some((source) => source.includes(literal(p)));

/**
 * What the steps file of one use case holds: the quickpickle names it imports and a pending
 * binding per phrase no sibling file binds yet; undefined when every phrase is bound already.
 */
export const stepsOptions = (
  feature: string,
  siblings: string[],
): { imports: string; bindings: string } | undefined => {
  const own = phrases(feature).filter((p) => !bound(siblings, p));
  if (own.length === 0) return undefined;
  const keywords = [...new Set(own.map((p) => p.keyword))].sort();
  const table = own.some((p) => p.params.includes('table: DataTable'))
    ? ['type DataTable']
    : [];
  return {
    imports: [...keywords, ...table].join(', '),
    bindings: own.map(binding).join('\n\n'),
  };
};
