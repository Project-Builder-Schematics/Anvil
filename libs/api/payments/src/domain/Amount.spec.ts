import { Amount } from './Amount';

describe('Amount', () => {
  it.each([1, 4500, 10_000])('accepts %i', (value) => {
    expect(Amount.of(value).value).toBe(value);
  });

  it.each([0, -1, 10.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s with INVALID_AMOUNT',
    (value) => {
      expect(() => Amount.of(value)).toThrow(
        expect.objectContaining({
          name: 'PaymentsError',
          code: 'INVALID_AMOUNT',
        }) as unknown,
      );
    },
  );
});
