import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  scenarioViolations,
  staleSources,
  statusViolations,
  unsourcedPorts,
  type Feature,
} from './docs-consistency.ts';
import { table } from './lib.ts';

// The domain models are the contract the generators and the features follow. These tests fail when
// a rule changes after its Source was recorded, when an assumed rule and the @draft tag disagree,
// when a sentence about confirmations contradicts the Source column, or when a port to a system we
// do not own has no source link.

const model = (
  rules: [number, string, string][],
  { prose = '', ports = [] as [string, string][] } = {},
): string =>
  [
    '## Business rules',
    '',
    prose,
    '',
    '| # | Rule | Source |',
    '| --- | --- | --- |',
    ...rules.map(([n, text, source]) => `| ${n} | ${text} | ${source} |`),
    '',
    '## Driven ports',
    '',
    '| Port | Answers | Adapter today | Contract |',
    '| --- | --- | --- | --- |',
    ...ports.map(([port, adapter]) => `| ${port} | x | ${adapter} | x |`),
    '',
  ].join('\n');

const feature = (...blocks: string[]): Feature => ({
  path: 'docs/x/do.feature',
  text: ['Feature: do', '', ...blocks].join('\n'),
});

describe('a rule changed after its Source was recorded', () => {
  const v1 = model([[1, 'The amount is above 0.', 'decided']]);

  it('accepts a rule that never changed', () => {
    expect(staleSources([{ model: v1 }, { model: v1 }])).toEqual([]);
  });

  it('fails when the text changed and the Source did not', () => {
    const v2 = model([[1, 'The amount is above 0, and kept.', 'decided']]);

    expect(staleSources([{ model: v2 }, { model: v1 }])).toEqual(['1']);
  });

  it('accepts a change that updates the Source in the same version', () => {
    const v2 = model([
      [1, 'The amount is above 0, and kept.', 'decided; amended 2026-10-09'],
    ]);

    expect(staleSources([{ model: v2 }, { model: v1 }])).toEqual([]);
  });

  it('accepts a Source recorded after the text, as when an assumed rule is confirmed', () => {
    const assumed = model([[1, 'The amount is above 0.', 'assumed']]);

    expect(staleSources([{ model: v1 }, { model: assumed }])).toEqual([]);
  });

  it('ignores how the table is aligned', () => {
    const padded = v1
      .replace('| 1 |', '| 1   |')
      .replace('decided |', 'decided   |');
    const edited = model([[1, 'The amount is above 0.', 'decided']]);

    expect(staleSources([{ model: padded }, { model: edited }])).toEqual([]);
  });

  it('judges only the rule that changed, and a rule that is new', () => {
    const v2 = model([
      [1, 'The amount is above 0.', 'decided'],
      [2, 'A second rule.', 'assumed'],
    ]);

    expect(staleSources([{ model: v2 }, { model: v1 }])).toEqual([]);
  });
});

describe('an assumed rule and the @draft tag', () => {
  const assumed = model([
    [1, 'Decided.', 'decided'],
    [2, 'Assumed.', 'assumed'],
  ]);

  it('accepts a draft scenario under an assumed rule and a plain one under a decided rule', () => {
    const ok = feature(
      'Rule: Rule 1 - Decided.',
      '  Scenario: a',
      '  Rule: Rule 2 - Assumed.',
      '  @draft',
      '  Scenario: b',
    );

    expect(scenarioViolations(assumed, [ok])).toEqual([]);
  });

  it('fails when a plain scenario backs an assumed rule', () => {
    const bad = feature('Rule: Rule 2 - Assumed.', '  Scenario: b');

    expect(scenarioViolations(assumed, [bad])).toEqual([
      'docs/x/do.feature: scenario "b" is not @draft but rule 2 is assumed',
    ]);
  });

  it('fails when a draft scenario has no assumed rule behind it', () => {
    const bad = feature('Rule: Rule 1 - Decided.', '  @draft', '  Scenario: a');

    expect(scenarioViolations(assumed, [bad])).toEqual([
      'docs/x/do.feature: scenario "a" is @draft but rule 1 is not assumed',
    ]);
  });

  it('reads a tag on the Rule line and an outline', () => {
    const ok = feature(
      '@draft',
      'Rule: Rule 2 - Assumed.',
      '  Scenario Outline: b',
    );

    expect(scenarioViolations(assumed, [ok])).toEqual([]);
  });
});

describe('a sentence about confirmations', () => {
  const rules: [number, string, string][] = [
    [1, 'One.', 'decided'],
    [2, 'Two.', 'decided'],
    [3, 'Three.', 'assumed'],
  ];

  it('accepts sentences that agree with the Source column', () => {
    const prose =
      'Rules 1 and 2 were approved by the user on 2026-10-08; rule 3 waits for the user to confirm it.';

    expect(statusViolations(model(rules, { prose }))).toEqual([]);
  });

  it('fails when a rule awaiting confirmation is already decided', () => {
    const prose = 'Rules 1 to 2 wait for the user to confirm them.';

    expect(statusViolations(model(rules, { prose }))).toHaveLength(1);
  });

  it('fails when a rule said to be approved is assumed', () => {
    const prose = 'Rules 1 to 3 were approved by the user.';

    expect(statusViolations(model(rules, { prose }))).toHaveLength(1);
  });

  it('fails a bare "not confirmed" while every rule is decided', () => {
    const decided = rules.map(([n, t]): [number, string, string] => [
      n,
      t,
      'decided',
    ]);
    const prose = 'The user has not confirmed them.';

    expect(statusViolations(model(decided, { prose }))).toHaveLength(1);
  });

  it('ignores a rule named inside parentheses', () => {
    const prose =
      'Rule 3 fills a gap (rule 1 is superseded) and waits for the user to confirm it.';

    expect(statusViolations(model(rules, { prose }))).toEqual([]);
  });
});

describe('a driven port to a system we do not own', () => {
  it('accepts Memory, a context barrel and a documented external adapter', () => {
    const ports: [string, string][] = [
      ['A', 'Memory: a map.'],
      ['B', '@payments: CHARGE_PAYMENT.'],
      ['C', 'Stripe, per [docs](https://docs.stripe.com/api).'],
    ];

    expect(unsourcedPorts(model([], { ports }))).toEqual([]);
  });

  it('fails an external adapter that cites no source', () => {
    const ports: [string, string][] = [['Gateway', 'Stripe over HTTP.']];

    expect(unsourcedPorts(model([], { ports }))).toEqual(['Gateway']);
  });
});

// --- The real docs.

const root = resolve(import.meta.dir, '../..');
const docs = join(root, 'docs');

/** Every `domain-model.md` below docs/, as paths relative to the repo. */
const modelPaths = (dir = docs): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return modelPaths(path);
    return entry.name === 'domain-model.md' ? [path] : [];
  });

const git = (...args: string[]): string => {
  const { stdout, exitCode } = Bun.spawnSync(['git', ...args], { cwd: root });
  if (exitCode !== 0) throw new Error(`git ${args.join(' ')} failed`);
  return stdout.toString();
};

/** The file's versions, newest first, working tree included; a version equal to the next one is dropped. */
const history = (path: string): { model: string }[] => {
  const rel = path.slice(root.length + 1);
  const commits = git('log', '--format=%H', '--', rel)
    .split('\n')
    .filter(Boolean);
  const versions = [
    readFileSync(path, 'utf8'),
    ...commits.map((sha) => git('show', `${sha}:${rel}`)),
  ];
  return versions
    .filter((text, i) => text !== versions[i - 1])
    .map((text) => ({ model: text }));
};

const featuresNextTo = (modelPath: string): Feature[] => {
  const dir = join(modelPath, '..');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.feature'))
    .map((name) => ({
      path: join(dir, name).slice(root.length + 1),
      text: readFileSync(join(dir, name), 'utf8'),
    }));
};

const models = modelPaths().map((path) => ({
  path: path.slice(root.length + 1),
  text: readFileSync(path, 'utf8'),
  full: path,
}));

describe('the docs of this repo', () => {
  it('has a corpus the checks can bite on', () => {
    const rules = models.flatMap(({ text }) => table(text, 'Business rules'));
    const scenarios = models
      .flatMap(({ full }) => featuresNextTo(full))
      .flatMap(({ text }) => text.match(/^\s*Scenario/gm) ?? []);
    const ports = models.flatMap(({ text }) => table(text, 'Driven ports'));

    expect(rules.length).toBeGreaterThan(40);
    expect(scenarios.length).toBeGreaterThan(100);
    expect(ports.length).toBeGreaterThan(5);
  });

  it('never changes a rule after its Source was recorded', () => {
    const stale = models.flatMap(({ path, full }) =>
      staleSources(history(full)).map((rule) => `${path}: rule ${rule}`),
    );

    expect(stale).toEqual([]);
  });

  it('keeps assumed rules and @draft scenarios in step', () => {
    const bad = models.flatMap(({ text, full }) =>
      scenarioViolations(text, featuresNextTo(full)),
    );

    expect(bad).toEqual([]);
  });

  it('keeps the status sentences in step with the Source column', () => {
    const bad = models.flatMap(({ path, text }) =>
      statusViolations(text).map((violation) => `${path}: ${violation}`),
    );

    expect(bad).toEqual([]);
  });

  it('cites a source for every port to a system we do not own', () => {
    const bad = models.flatMap(({ path, text }) =>
      unsourcedPorts(text).map((port) => `${path}: ${port}`),
    );

    expect(bad).toEqual([]);
  });
});
