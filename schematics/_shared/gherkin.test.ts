import { describe, expect, it } from 'bun:test';
import { binding, phrases, stepsSource } from './gherkin.ts';

const feature = `Feature: Issue invoice

  Rule: an invoice needs lines

    Scenario: no lines
      Given customer "acme" without lines
      And an invoice dated 2026
      When "usr-7" issues the invoice
      Then the failure is "LINES_REQUIRED"
      But nothing is stored

    Scenario: with a table
      Given these lines
        | sku | qty |
        | a   | 1   |
      Then the failure is "NONE"
`;

describe('phrases', () => {
  it('lists each distinct step once, And/But taking the keyword before them', () => {
    expect(phrases(feature).map((p) => [p.keyword, p.expression])).toEqual([
      ['Given', 'customer {string} without lines'],
      ['Given', 'an invoice dated {int}'],
      ['When', '{string} issues the invoice'],
      ['Then', 'the failure is {string}'],
      ['Then', 'nothing is stored'],
      ['Given', 'these lines'],
    ]);
  });

  it('types parameters and adds a data table argument', () => {
    const [first, second, , , , table] = phrases(feature);

    expect(first?.params).toEqual(['arg0: string']);
    expect(second?.params).toEqual(['arg0: number']);
    expect(table?.params).toEqual(['table: DataTable']);
  });

  it('ignores the text inside doc strings', () => {
    expect(
      phrases(
        'Scenario: s\n  Given a thing\n    """\n    Then not a step\n    """\n',
      ),
    ).toHaveLength(1);
  });
});

describe('binding', () => {
  it('is a pending quickpickle step definition', () => {
    const [first] = phrases(feature);

    expect(binding(first as never)).toBe(
      "Given('customer {string} without lines', (_world, arg0: string) => 'skipped');",
    );
  });

  it('escapes quotes in the expression', () => {
    expect(
      binding({
        keyword: 'Then',
        text: "it's done",
        expression: "it's done",
        params: [],
      }),
    ).toBe("Then('it\\'s done', () => 'skipped');");
  });
});

describe('stepsSource', () => {
  it('imports only the keywords it uses, and DataTable only when a step takes a table', () => {
    const source = stepsSource(feature, []);

    expect(source).toContain(
      "import { Given, Then, When, type DataTable } from 'quickpickle';",
    );
    expect(stepsSource('Scenario: s\n  Then done\n', [])).toContain(
      "import { Then } from 'quickpickle';",
    );
  });

  it('skips a phrase a sibling steps file already binds', () => {
    const sibling = "Then('the failure is {string}', () => 'skipped');";
    const source = stepsSource(feature, [sibling]);

    expect(source).not.toContain('the failure is {string}');
    expect(source).toContain('nothing is stored');
  });

  it('says why the unused-variable rule is off for generated bindings', () => {
    expect(stepsSource(feature, []).split('\n')[0]).toMatch(
      /^\/\* eslint-disable @typescript-eslint\/no-unused-vars -- .+ \*\/$/,
    );
  });
});
