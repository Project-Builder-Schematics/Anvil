import { StockLevel } from './StockLevel';

const refused: unknown = expect.objectContaining({
  name: 'InventoryError',
  code: 'STOCK_LEVEL_INVALID',
});

describe('StockLevel', () => {
  it.each([0, 1, 10_000])('accepts %i', (value) => {
    expect(StockLevel.of(value).value).toBe(value);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s with STOCK_LEVEL_INVALID',
    (value) => {
      expect(() => StockLevel.of(value)).toThrow(refused);
    },
  );
});
