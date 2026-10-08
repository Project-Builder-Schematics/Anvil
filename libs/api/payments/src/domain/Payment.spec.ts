import { Amount } from './Amount';
import { Payment } from './Payment';

const pending = () => Payment.pending('o1', Amount.of(4500), 'USD');

describe('Payment', () => {
  it('starts pending with what it was asked to charge', () => {
    expect(pending()).toMatchObject({
      orderId: 'o1',
      amount: Amount.of(4500),
      currency: 'USD',
      status: 'Pending',
    });
  });

  it('is captured or failed from pending', () => {
    expect(pending().capture().status).toBe('Captured');
    expect(pending().fail().status).toBe('Failed');
  });

  it('is refunded from captured', () => {
    expect(pending().capture().refund().status).toBe('Refunded');
  });

  it.each([
    ['pending', pending()],
    ['failed', pending().fail()],
    ['refunded', pending().capture().refund()],
  ])('cannot be refunded when %s', (_status, payment) => {
    expect(() => payment.refund()).toThrow(
      expect.objectContaining({
        name: 'PaymentsError',
        code: 'PAYMENT_NOT_REFUNDABLE',
      }) as unknown,
    );
  });

  it('counts as the successful charge once captured, and stays so when refunded', () => {
    expect(pending().isCharged).toBe(false);
    expect(pending().fail().isCharged).toBe(false);
    expect(pending().capture().isCharged).toBe(true);
    expect(pending().capture().refund().isCharged).toBe(true);
  });
});
