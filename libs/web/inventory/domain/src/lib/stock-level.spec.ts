import { availableOf, isOnHand, type StockLevel } from './stock-level';

const level = (onHand: number, reserved: number): StockLevel => ({
  productId: 'keyboard',
  onHand,
  reserved,
});

describe('availableOf', () => {
  it('is what is on hand minus what is reserved (rule I1)', () => {
    expect(availableOf(level(50, 0))).toBe(50);
    expect(availableOf(level(50, 12))).toBe(38);
    expect(availableOf(level(7, 7))).toBe(0);
  });
});

describe('isOnHand', () => {
  it.each([0, 1, 50, 1_000_000])('accepts %d (rule I6)', (value) => {
    expect(isOnHand(value)).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, Infinity, null, undefined, '5'])(
    'refuses %j',
    (value) => {
      expect(isOnHand(value)).toBe(false);
    },
  );
});
