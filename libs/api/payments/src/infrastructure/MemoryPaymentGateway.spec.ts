import { MemoryPaymentGateway } from './MemoryPaymentGateway';

const charge = (paymentMethodToken: string) =>
  new MemoryPaymentGateway().charge({
    amount: 4500,
    currency: 'USD',
    paymentMethodToken,
  });

describe('MemoryPaymentGateway (PaymentGateway contract)', () => {
  it('declines tok_decline', async () => {
    expect(await charge('tok_decline')).toBe('Declined');
  });

  it.each(['tok_visa', 'tok_declined', 'TOK_DECLINE', ''])(
    'captures %j',
    async (token) => {
      expect(await charge(token)).toBe('Captured');
    },
  );
});
