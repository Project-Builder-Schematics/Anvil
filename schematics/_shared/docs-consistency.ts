import { table } from './lib.ts';

export interface Version {
  /** The domain model as of one commit; a history lists the newest version first. */
  model: string;
}

export interface Feature {
  path: string;
  text: string;
}

const rules = (model: string): Map<string, { text: string; source: string }> =>
  new Map(
    table(model, 'Business rules').map(
      ([number = '', text = '', source = '']) => [number, { text, source }],
    ),
  );

const isAssumed = (source: string): boolean => source.startsWith('assumed');

/**
 * The rules whose text was last changed by a newer version than the one that last changed their
 * Source, so the Source no longer vouches for the text. A change to the Source in the same or a later
 * version clears it; a Source that already named that date does not. Rules are followed by number.
 */
export const staleSources = (history: Version[]): string[] => {
  const versions = history.map(({ model }) => rules(model));
  const current = versions[0];
  if (!current) return [];

  /** Index of the oldest version of the unbroken run, from the newest, in which the field holds. */
  const introducedBy = (number: string, field: 'text' | 'source'): number => {
    const value = current.get(number)?.[field];
    let index = 0;
    while (versions[index + 1]?.get(number)?.[field] === value) index += 1;
    return index;
  };

  return [...current.keys()].filter(
    (number) => introducedBy(number, 'text') < introducedBy(number, 'source'),
  );
};

const featureRule = /^\s*Rule:\s*Rule (\d+)\b/;
const featureScenario = /^\s*(?:Scenario Outline|Scenario|Example):\s*(.+)$/;

/** A scenario backs an assumed rule if and only if it is tagged `@draft`. */
export const scenarioViolations = (
  model: string,
  features: Feature[],
): string[] => {
  const byNumber = rules(model);
  return features.flatMap(({ path, text }) => {
    let tags: string[] = [];
    let featureTags: string[] = [];
    let ruleTags: string[] = [];
    let rule: string | undefined;
    const found: string[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        tags = trimmed.split(/\s+/);
      } else if (trimmed.startsWith('Feature:')) {
        featureTags = tags;
        tags = [];
      } else if (featureRule.test(line)) {
        rule = featureRule.exec(line)?.[1];
        ruleTags = tags;
        tags = [];
      } else if (featureScenario.test(line)) {
        const name = featureScenario.exec(line)?.[1] ?? '';
        const draft = [...featureTags, ...ruleTags, ...tags].includes('@draft');
        const assumed = isAssumed(byNumber.get(rule ?? '')?.source ?? '');
        if (assumed && !draft)
          found.push(
            `${path}: scenario "${name}" is not @draft but rule ${rule} is assumed`,
          );
        if (draft && !assumed)
          found.push(
            `${path}: scenario "${name}" is @draft but rule ${rule ?? '(none)'} is not assumed`,
          );
        tags = [];
      } else if (trimmed !== '') {
        tags = [];
      }
    }
    return found;
  });
};

const NOT_CONFIRMED =
  /\b(?:wait(?:s|ing)? for|(?:is|are|was|were|been) not (?:yet )?(?:confirmed|approved|decided)|(?:has|have) not (?:yet )?(?:confirmed|approved)|unconfirmed|pending confirmation)/i;
const CONFIRMED =
  /\b(?:was|were|is|are|been)\s+(?:\S+\s+){0,6}?(?:confirmed|approved|decided)\b/i;

/** `rules 3 to 5 and 9` → ['3', '4', '5', '9']; rules named inside parentheses are asides and skipped. */
const citedRules = (clause: string): string[] =>
  [
    ...clause
      .replace(/\([^)]*\)/g, '')
      .matchAll(
        /\brules?\s+((?:\d+(?:\s+to\s+\d+)?(?:\s*,\s*|\s+and\s+)?)+)/gi,
      ),
  ]
    .flatMap((match) => [
      ...(match[1] ?? '').matchAll(/(\d+)(?:\s+to\s+(\d+))?/g),
    ])
    .flatMap(([, from = '0', to = from]) =>
      Array.from({ length: Number(to) - Number(from) + 1 }, (_, i) =>
        String(Number(from) + i),
      ),
    );

/** The prose of the Business rules section must say of each rule it cites what its Source says. */
export const statusViolations = (model: string): string[] => {
  const byNumber = rules(model);
  const prose = model
    .split(/^## Business rules\s*$/m)[1]
    ?.split(/^## /m)[0]
    ?.split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('|'))
    .join(' ');
  const clauses = (prose ?? '').split(/;|\.(?=\s|$)/).map((c) => c.trim());
  const allDecided = [...byNumber.values()].every(
    ({ source }) => !isAssumed(source),
  );

  return clauses.flatMap((clause) => {
    const cited = citedRules(clause).filter((n) => byNumber.has(n));
    const decided = cited.filter(
      (n) => !isAssumed(byNumber.get(n)?.source ?? ''),
    );
    const assumed = cited.filter((n) =>
      isAssumed(byNumber.get(n)?.source ?? ''),
    );
    if (NOT_CONFIRMED.test(clause))
      return (cited.length > 0 ? decided.length > 0 : allDecided)
        ? [
            `"${clause}" awaits a confirmation the Source column records${decided.length > 0 ? ` for rules ${decided.join(', ')}` : ''}`,
          ]
        : [];
    if (CONFIRMED.test(clause) && assumed.length > 0)
      return [
        `"${clause}" says rules ${assumed.join(', ')} are confirmed but they are assumed`,
      ];
    return [];
  });
};

/** Ports whose `Adapter today` is neither `Memory` nor `@<context>` and whose row links no source. */
export const unsourcedPorts = (model: string): string[] =>
  table(model, 'Driven ports')
    .filter(
      (cells) =>
        !/^(?:Memory\b|@[a-z])/.test(cells[2] ?? '') &&
        !cells.some((cell) => /\]\(https?:\/\/|https?:\/\//.test(cell)),
    )
    .map(([port = '']) => port);
