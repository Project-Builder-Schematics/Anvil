// The part of the engine's Go text/template that schematic templates may use, so the tests can
// render what the real engine renders. Anything outside it throws: a template is dumb on purpose,
// and a construct the tests cannot model must not reach the engine either.
//
//   {= .name =}                      a string, number or boolean option
//   {= range .list =}…{= end =}      repeat for each item; inside, `.` is the item, `.field` its field
//   {= "text" =}                     a literal, the way to write `{=` itself
//   {=- … -=}                        trim the whitespace before / after the action

type Node =
  | { text: string }
  | { print: string }
  | { literal: string }
  | { range: string; body: Node[] };

interface Action {
  body: string;
  trimBefore: boolean;
  trimAfter: boolean;
  start: number;
  end: number;
}

const OPEN = '{=';
const CLOSE = '=}';

const actions = (template: string): Action[] => {
  const found: Action[] = [];
  for (let at = template.indexOf(OPEN); at !== -1;) {
    const close = template.indexOf(CLOSE, at + OPEN.length);
    if (close === -1)
      throw new Error(`unclosed action at offset ${String(at)}`);
    const raw = template.slice(at + OPEN.length, close);
    const trimBefore = raw.startsWith('- ');
    const trimAfter = raw.endsWith(' -');
    found.push({
      body: raw.slice(trimBefore ? 2 : 0, trimAfter ? -2 : undefined).trim(),
      trimBefore,
      trimAfter,
      start: at,
      end: close + CLOSE.length,
    });
    at = template.indexOf(OPEN, close + CLOSE.length);
  }
  return found;
};

const FIELD = /^\.(?:[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)?$/;
const LITERAL = /^"([^"\\]*)"$/;

/** The tree of a template; throws on any action the subset does not have. */
export const parse = (template: string): Node[] => {
  const root: Node[] = [];
  const open: Array<{ range: string; body: Node[] }> = [];
  const into = (): Node[] => open[open.length - 1]?.body ?? root;
  let at = 0;
  let trimNext = false;
  const pushText = (text: string, trimEnd: boolean): void => {
    const kept = trimNext ? text.trimStart() : text;
    trimNext = false;
    const final = trimEnd ? kept.trimEnd() : kept;
    if (final !== '') into().push({ text: final });
  };
  for (const action of actions(template)) {
    pushText(template.slice(at, action.start), action.trimBefore);
    trimNext = action.trimAfter;
    at = action.end;
    const { body } = action;
    const range = /^range\s+(\S+)$/.exec(body)?.[1];
    if (range !== undefined) {
      if (!FIELD.test(range) || range === '.')
        throw new Error(`unsupported action "${body}": range over a field`);
      const node = { range, body: [] as Node[] };
      into().push(node);
      open.push(node);
    } else if (body === 'end') {
      if (open.pop() === undefined) throw new Error('"end" without a range');
    } else if (LITERAL.test(body)) {
      into().push({ literal: LITERAL.exec(body)?.[1] ?? '' });
    } else if (FIELD.test(body)) {
      into().push({ print: body });
    } else {
      throw new Error(
        `unsupported action "${body}": only a field, a range over a field, end and a "literal" are modelled`,
      );
    }
  }
  pushText(template.slice(at), false);
  if (open.length > 0) throw new Error('a range is not closed with "end"');
  return root;
};

const lookup = (dot: unknown, field: string): unknown => {
  if (field === '.') return dot;
  let value = dot;
  for (const key of field.slice(1).split('.')) {
    if (typeof value !== 'object' || value === null || !(key in value))
      throw new Error(`map has no entry for key "${key}"`);
    value = (value as Record<string, unknown>)[key];
  }
  return value;
};

const evaluate = (nodes: Node[], dot: unknown): string =>
  nodes
    .map((node) => {
      if ('text' in node) return node.text;
      if ('literal' in node) return node.literal;
      if ('print' in node) {
        const value = lookup(dot, node.print);
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        )
          return String(value);
        throw new Error(
          `${node.print} is ${Array.isArray(value) ? 'a list' : String(value)} and cannot be printed`,
        );
      }
      const items = lookup(dot, node.range);
      if (!Array.isArray(items))
        throw new Error(
          `${node.range} is not a list and cannot be ranged over`,
        );
      return items.map((item) => evaluate(node.body, item)).join('');
    })
    .join('');

/**
 * The engine receives a list or an object option as JSON text and decodes it before rendering, and
 * it decodes any text option that reads as one: `'{}'` becomes a Go map and prints as `map[]`.
 * Decoding the same values here makes printing such a text throw instead of rendering something else.
 */
const decode = (options: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(options).map(([key, value]) => {
      if (typeof value !== 'string' || !/^\s*[[{]/.test(value))
        return [key, value];
      try {
        return [key, JSON.parse(value) as unknown];
      } catch {
        return [key, value];
      }
    }),
  );

export const render = (
  template: string,
  options: Record<string, unknown>,
): string => evaluate(parse(template), decode(options));
