import {
  canCancel,
  canEdit,
  canPlace,
  isQuantity,
  lineTotal,
  orderTotal,
  withStatus,
  type Order,
  type OrderLine,
} from './order';

const keyboard: OrderLine = {
  productId: 'keyboard',
  quantity: 2,
  unitPrice: { amount: 4500, currency: 'USD' },
};
const mouse: OrderLine = {
  productId: 'mouse',
  quantity: 1,
  unitPrice: { amount: 1500, currency: 'USD' },
};
const order = (status: Order['status'], lines: OrderLine[] = []): Order => ({
  orderId: 'o1',
  status,
  lines,
});

describe('totals', () => {
  it('multiplies the unit price by the quantity', () => {
    expect(lineTotal(keyboard)).toEqual({ amount: 9000, currency: 'USD' });
  });

  it('sums the lines in their currency, and has no total without lines', () => {
    expect(orderTotal([keyboard, mouse])).toEqual({
      amount: 10500,
      currency: 'USD',
    });
    expect(orderTotal([])).toBeNull();
  });
});

describe('what the status allows', () => {
  it('lets only a draft change its lines (rule 4)', () => {
    expect(canEdit(order('Draft'))).toBe(true);
    expect(canEdit(order('Placed'))).toBe(false);
    expect(canEdit(order('Cancelled'))).toBe(false);
  });

  it('lets only a draft with a line be placed (rules 6 and 10)', () => {
    expect(canPlace(order('Draft', [mouse]))).toBe(true);
    expect(canPlace(order('Draft'))).toBe(false);
    expect(canPlace(order('Placed', [mouse]))).toBe(false);
    expect(canPlace(order('Cancelled', [mouse]))).toBe(false);
  });

  it('lets a draft or a placed order be cancelled (rule 8)', () => {
    expect(canCancel(order('Draft'))).toBe(true);
    expect(canCancel(order('Placed'))).toBe(true);
    expect(canCancel(order('Cancelled'))).toBe(false);
  });
});

describe('withStatus', () => {
  it('changes the status and keeps the lines', () => {
    expect(withStatus(order('Draft', [mouse]), 'Placed')).toEqual(
      order('Placed', [mouse]),
    );
  });
});

describe('isQuantity', () => {
  it.each([1, 2, 98, 99])('accepts %d (rule 2)', (value) => {
    expect(isQuantity(value)).toBe(true);
  });

  it.each([0, 100, -1, 1.5, Number.NaN, null, undefined, '2'])(
    'refuses %j',
    (value) => {
      expect(isQuantity(value)).toBe(false);
    },
  );
});
