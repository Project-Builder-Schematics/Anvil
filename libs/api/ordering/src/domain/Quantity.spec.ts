import { Quantity } from './Quantity';

const refused: unknown = expect.objectContaining({
  name: 'OrderingError',
  code: 'QUANTITY_OUT_OF_RANGE',
});

describe('Quantity', () => {
  it.each([1, 2, 98, 99])('accepts %i', (value) => {
    expect(Quantity.of(value).value).toBe(value);
  });

  it.each([0, -1, 100, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s with QUANTITY_OUT_OF_RANGE',
    (value) => {
      expect(() => Quantity.of(value)).toThrow(refused);
    },
  );

  it('adds two quantities', () => {
    expect(Quantity.of(2).add(Quantity.of(3)).value).toBe(5);
  });

  it('accepts a sum of exactly 99', () => {
    expect(Quantity.of(60).add(Quantity.of(39)).value).toBe(99);
  });

  it('refuses a sum above 99 with QUANTITY_OUT_OF_RANGE', () => {
    expect(() => Quantity.of(60).add(Quantity.of(40))).toThrow(refused);
  });
});
