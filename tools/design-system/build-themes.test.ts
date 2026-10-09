import { describe, expect, it } from 'bun:test';
import { contractVars } from '../../libs/web/shared/design-system/src/tokens/contract';
import { loadThemes, renderCss, resolveTheme } from './build-themes';

describe('vendored themes', () => {
  const themes = loadThemes();

  it('ships the control and the variant', () => {
    expect(themes.map((theme) => theme.name).sort()).toEqual([
      'shopify',
      'stripe',
    ]);
  });

  it.each(['shopify', 'stripe'])('%s resolves every contract token', (name) => {
    const theme = themes.find((candidate) => candidate.name === name);
    expect(Object.keys(theme?.vars ?? {}).sort()).toEqual(
      [...contractVars].sort(),
    );
  });
});

describe('resolveTheme', () => {
  const frontmatter = {
    colors: { primary: '#111' },
    typography: {
      t: {
        fontFamily: 'X',
        fontSize: '10px',
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: 0,
      },
    },
  };

  it('reads literals and paths, normalising numbers to strings', () => {
    const vars = resolveTheme(
      frontmatter,
      {
        'color.primary': { path: 'colors.primary' },
        'color.danger': { literal: '#f00' },
        'type.display': { path: 'typography.t' },
      },
      ['color.primary', 'color.danger', 'type.display'],
    );
    expect(vars).toMatchObject({
      '--ds-color-primary': '#111',
      '--ds-color-danger': '#f00',
      '--ds-type-display-family': 'X',
      '--ds-type-display-weight': '400',
      '--ds-type-display-line-height': '1.2',
      '--ds-type-display-letter-spacing': '0',
    });
  });

  it('fails when a contract token is not mapped', () => {
    expect(() => resolveTheme(frontmatter, {}, ['color.primary'])).toThrow(
      'color.primary',
    );
  });

  it('fails when a mapping path does not resolve', () => {
    expect(() =>
      resolveTheme(
        frontmatter,
        { 'color.primary': { path: 'colors.missing' } },
        ['color.primary'],
      ),
    ).toThrow('colors.missing');
  });
});

describe('renderCss', () => {
  it('puts the default theme on :root as well as under its data-theme', () => {
    const css = renderCss(
      [
        { name: 'a', vars: { '--ds-x': '1' } },
        { name: 'b', vars: { '--ds-x': '2' } },
      ],
      'a',
    );
    expect(css).toContain(':root,\n[data-theme="a"] {\n  --ds-x: 1;\n}');
    expect(css).toContain('[data-theme="b"] {\n  --ds-x: 2;\n}');
  });
});
