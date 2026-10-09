import { parseOverrides } from './overrides';

describe('parseOverrides', () => {
  it('parses one or many key:variant pairs', () => {
    expect(parseOverrides('?exp=theme:b')).toEqual({ theme: 'b' });
    expect(parseOverrides('?x=1&exp=theme:b,checkout-cta:control')).toEqual({
      theme: 'b',
      'checkout-cta': 'control',
    });
  });

  it('ignores malformed pairs and a missing parameter', () => {
    expect(parseOverrides('?exp=theme,:b,ok:v')).toEqual({ ok: 'v' });
    expect(parseOverrides('')).toEqual({});
  });
});
