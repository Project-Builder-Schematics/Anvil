import { GatewayError, MemoryPaymentGateway } from './MemoryPaymentGateway';

const request = (paymentMethodToken: string, idempotencyKey = 'p1') => ({
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

  it('replays a captured outcome for the same key and request', async () => {
    const gateway = new MemoryPaymentGateway();
    await gateway.charge(request('tok_visa'));
    expect(await gateway.charge(request('tok_visa'))).toBe('Captured');
    expect(gateway.captured).toBe(1);
  });

  it('replays a decline for the same key and request', async () => {
    const gateway = new MemoryPaymentGateway();
    expect(await gateway.charge(request('tok_decline'))).toBe('Declined');
    expect(gateway.outcomes.get('p1')?.outcome).toBe('Declined');
    expect(await gateway.charge(request('tok_decline'))).toBe('Declined');
  });

  it('refuses the same key with another request and keeps the first outcome', async () => {
    const gateway = new MemoryPaymentGateway();
    await gateway.charge(request('tok_visa'));
    await expect(gateway.charge(request('tok_decline'))).rejects.toBeInstanceOf(
      GatewayError,
    );
    await expect(
      gateway.charge({ ...request('tok_visa'), amount: 1 }),
    ).rejects.toThrow('idempotency key reused with different parameters');
    await expect(
      gateway.charge({ ...request('tok_visa'), currency: 'EUR' }),
    ).rejects.toThrow('idempotency key reused with different parameters');
    expect(gateway.outcomes.get('p1')?.outcome).toBe('Captured');
  });

  it('takes the money once for two charges started together', async () => {
    const gateway = new MemoryPaymentGateway();
    await Promise.all([
      gateway.charge(request('tok_visa')),
      gateway.charge(request('tok_visa')),
    ]);
    expect(gateway.captured).toBe(1);
  });

  it('charges each key on its own', async () => {
    const gateway = new MemoryPaymentGateway();
    await gateway.charge(request('tok_visa', 'k1'));
    await gateway.charge(request('tok_visa', 'k2'));
    expect(gateway.captured).toBe(2);
  });

  it('charges a new key again after a decline', async () => {
    const gateway = new MemoryPaymentGateway();
    expect(await gateway.charge(request('tok_decline', 'k1'))).toBe('Declined');
    expect(await gateway.charge(request('tok_visa', 'k2'))).toBe('Captured');
    expect(gateway.captured).toBe(1);
  });
});
