import { Money } from './Money';

describe('Money', () => {
  it('keeps the amount in minor units and the currency', () => {
    const money = Money.of(4500, 'USD');
    expect(money.amount).toBe(4500);
    expect(money.currency).toBe('USD');
  });

  it('accepts a zero amount', () => {
    expect(Money.of(0, 'EUR').amount).toBe(0);
  });

  it.each([-1, 1.5, Number.NaN])('refuses the amount %s', (amount) => {
    expect(() => Money.of(amount, 'USD')).toThrow(
      new RangeError('Money amount must be a non-negative integer'),
    );
  });

  it.each(['', 'US', 'USDX', 'usd', 'U$D', ' USD'])(
    'refuses the currency "%s"',
    (currency) => {
      expect(() => Money.of(100, currency)).toThrow(
        new RangeError('Money currency must be three uppercase letters'),
      );
    },
  );
});
