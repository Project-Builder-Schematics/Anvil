import { MemoryPaymentGateway } from './MemoryPaymentGateway';

const request = (paymentMethodToken: string, idempotencyKey = 'o1') => ({
  amount: 4500,
  currency: 'USD',
  paymentMethodToken,
  idempotencyKey,
});

describe('MemoryPaymentGateway (PaymentGateway contract)', () => {
  it('declines tok_decline', async () => {
    expect(
      await new MemoryPaymentGateway().charge(request('tok_decline')),
    ).toBe('Declined');
  });

  it.each(['tok_visa', 'tok_declined', 'TOK_DECLINE', ''])(
    'captures %j',
    async (token) => {
      expect(await new MemoryPaymentGateway().charge(request(token))).toBe(
        'Captured',
      );
    },
  );

  it('takes the money once per idempotency key and repeats the first outcome', async () => {
    const gateway = new MemoryPaymentGateway();
    await gateway.charge(request('tok_visa'));
    expect(await gateway.charge(request('tok_decline'))).toBe('Captured');
    expect([...gateway.capturedKeys]).toEqual(['o1']);
  });

  it('takes the money once for two charges started together', async () => {
    const gateway = new MemoryPaymentGateway();
    await Promise.all([
      gateway.charge(request('tok_visa')),
      gateway.charge(request('tok_visa')),
    ]);
    expect(gateway.capturedKeys.size).toBe(1);
  });

  it('charges each key on its own', async () => {
    const gateway = new MemoryPaymentGateway();
    await gateway.charge(request('tok_visa', 'o1'));
    await gateway.charge(request('tok_visa', 'o2'));
    expect(gateway.capturedKeys.size).toBe(2);
  });

  it('does not remember a decline, so the same key can be charged again', async () => {
    const gateway = new MemoryPaymentGateway();
    expect(await gateway.charge(request('tok_decline'))).toBe('Declined');
    expect(await gateway.charge(request('tok_visa'))).toBe('Captured');
    expect(gateway.capturedKeys.size).toBe(1);
  });
});
