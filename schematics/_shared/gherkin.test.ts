import { describe, expect, it } from 'bun:test';
import { binding, phrases, stepsOptions } from './gherkin.ts';

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

  it('reads a decimal number as one {float}, not as two integers around a dot', () => {
    const [p] = phrases('Scenario: s\n  When it is charged 10.5 "USD"\n');

    expect(p?.expression).toBe('it is charged {float} {string}');
    expect(p?.params).toEqual(['arg0: number', 'arg1: string']);
  });

  it('binds one {float} step for a phrase seen with both integers and decimals', () => {
    const list = phrases(
      'Scenario: s\n  When it is charged 4500 "USD"\n  When it is charged 10.5 "USD"\n',
    );

    expect(list.map((p) => p.expression)).toEqual([
      'it is charged {float} {string}',
    ]);
  });

  it('ignores the text inside doc strings', () => {
    expect(
      phrases(
        'Scenario: s\n  Given a thing\n    """\n    Then not a step\n    """\n',
      ),
    ).toHaveLength(1);
  });
});

describe('cucumber expressions', () => {
  it('escapes what a cucumber expression would read as syntax', () => {
    const [p] = phrases(
      'Scenario: s\n  Given the (draft) order {x} costs a/b\n',
    );

    expect(p?.expression).toBe('the \\(draft\\) order \\{x\\} costs a\\/b');
  });

  it('writes the escapes into a string literal that keeps them', () => {
    const [p] = phrases('Scenario: s\n  Given a (draft) of "x" it\'s\n');

    expect(binding(p as never)).toBe(
      "Given('a \\\\(draft\\\\) of {string} it\\'s', (_world, arg0: string) => {\n  throw new Error('step not implemented: a (draft) of \"x\" it\\'s');\n});",
    );
  });

  it('does not bind again a phrase whose sibling holds it escaped', () => {
    const [p] = phrases('Scenario: s\n  Given a (draft)\n');
    const sibling = binding(p as never);

    expect(
      stepsOptions('Scenario: s\n  Given a (draft)\n', [sibling]),
    ).toBeUndefined();
  });
});

describe('binding', () => {
  it('is a quickpickle step definition that fails until it is implemented', () => {
    const [first] = phrases(feature);

    expect(binding(first as never)).toBe(
      "Given('customer {string} without lines', (_world, arg0: string) => {\n  throw new Error('step not implemented: customer \"acme\" without lines');\n});",
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
    ).toBe(
      "Then('it\\'s done', () => {\n  throw new Error('step not implemented: it\\'s done');\n});",
    );
  });
});

describe('stepsOptions', () => {
  it('imports only the keywords it uses, and DataTable only when a step takes a table', () => {
    expect(stepsOptions(feature, [])?.imports).toBe(
      'Given, Then, When, type DataTable',
    );
    expect(stepsOptions('Scenario: s\n  Then done\n', [])?.imports).toBe(
      'Then',
    );
  });

  it('binds each phrase once, in order, separated by a blank line', () => {
    const [first, second] = phrases(feature);

    expect(stepsOptions(feature, [])?.bindings).toStartWith(
      `${binding(first as never)}\n\n${binding(second as never)}\n\n`,
    );
  });

  it('skips a phrase a sibling steps file already binds', () => {
    const sibling = "Then('the failure is {string}', () => 'skipped');";
    const bindings = stepsOptions(feature, [sibling])?.bindings;

    expect(bindings).not.toContain('the failure is {string}');
    expect(bindings).toContain('nothing is stored');
  });
});
