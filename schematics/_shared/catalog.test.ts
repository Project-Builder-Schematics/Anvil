import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path: string): string => readFileSync(`${root}/${path}`, 'utf8');

const registered = Object.keys(
  (
    JSON.parse(read('project-builder.json')) as {
      collections: { default: Record<string, unknown> };
    }
  ).collections.default,
).sort();

/** Schematic names in the second cell of a markdown table row, e.g. `| New lib | \`hex-slice\` |`. */
const routed = (markdown: string): string[] =>
  [...markdown.matchAll(/^\|[^|\n]*\|\s*`([a-z][a-z0-9-]*)`\s*\|/gm)]
    .map((match) => match[1] ?? '')
    .sort();

/** Schematic names of the `### \`name\`` headings. */
const headings = (markdown: string): string[] =>
  [...markdown.matchAll(/^### `([a-z][a-z0-9-]*)`\s*$/gm)]
    .map((match) => match[1] ?? '')
    .sort();

describe('the schematic catalog', () => {
  it.each([
    ['the AGENTS.md routing table', routed(read('AGENTS.md'))],
    [
      'the schematics skill routing table',
      routed(read('.claude/skills/schematics/SKILL.md')),
    ],
    [
      'the schematics skill sections',
      headings(read('.claude/skills/schematics/SKILL.md')),
    ],
  ])(
    '%s lists exactly the schematics registered in project-builder.json',
    (_where, listed) => {
      expect(listed).toEqual(registered);
    },
  );
});
