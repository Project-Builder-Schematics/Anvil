import { Amount } from '../domain/Amount';
import { Payment } from '../domain/Payment';
import { toView } from './PaymentView';

describe('toView', () => {
  it('shows the payment in primitives, with the amount as a number', () => {
    const payment = Payment.pending('o1', Amount.of(4500), 'USD').capture();
    expect(toView(payment)).toEqual({
      orderId: 'o1',
      status: 'Captured',
      amount: 4500,
      currency: 'USD',
    });
  });
});
