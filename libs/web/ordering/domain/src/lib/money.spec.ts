import { formatMoney } from './money';

describe('formatMoney', () => {
  it.each([
    [{ amount: 4500, currency: 'USD' }, '$45.00'],
    [{ amount: 1999, currency: 'EUR' }, '€19.99'],
    [{ amount: 0, currency: 'USD' }, '$0.00'],
    [{ amount: 500, currency: 'JPY' }, '¥500'],
  ])('shows %j as %s', (money, text) => {
    expect(formatMoney(money)).toBe(text);
  });
});
