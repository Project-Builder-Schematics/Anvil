import { MemoryPayments } from './MemoryPayments';
import type {
  ChargeOutcome,
  PaymentGateway,
} from '../domain/driven-ports/PaymentGateway';
import { makeChargePayment } from '../application/ChargePayment';
import { PaymentsError } from '../domain/errors';

/** A gateway whose answers the test releases one by one, in the order it chooses. */
const heldGateway = () => {
  const releases: ((outcome: ChargeOutcome) => void)[] = [];
  const gateway: PaymentGateway = {
    charge: () =>
      new Promise<ChargeOutcome>((resolve) => releases.push(resolve)),
  };
  return {
    gateway,
    /** Resolves once the gateway has been asked `count` times. */
    asked: async (count: number) => {
      await vi.waitFor(() => {
        expect(releases).toHaveLength(count);
      });
    },
    release: (i: number, outcome: ChargeOutcome) => {
      const resolve = releases[i];
      if (!resolve) throw new Error(`the gateway was not asked ${i + 1} times`);
      resolve(outcome);
    },
  };
};

const command = (paymentMethodToken: string) => ({
  orderId: 'o1',
  amount: 4500,
  currency: 'USD',
  paymentMethodToken,
});

/** How a charge ended: a decline is the only refusal these scenarios expect. */
const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: unknown) => {
      if (error instanceof PaymentsError && error.code === 'PAYMENT_DECLINED')
        return 'declined';
      throw error;
    },
  );

describe('ChargePayment over MemoryPayments, charges that overlap', () => {
  it('lets the late decline of a replaced payment leave the new pending one alone', async () => {
    const payments = new MemoryPayments();
    const { gateway, asked, release } = heldGateway();
    const charge = makeChargePayment(payments, gateway);

    const a = settle(charge(command('tok_decline')));
    const b = settle(charge(command('tok_decline')));
    await asked(2);
    release(0, 'Declined');
    expect(await a).toBe('declined');

    const c = settle(charge(command('tok_visa')));
    await asked(3);
    release(1, 'Declined');
    expect(await b).toBe('declined');
    expect(await payments.byOrderId('o1')).toMatchObject({
      status: 'Pending',
      paymentMethodToken: 'tok_visa',
    });

    release(2, 'Captured');
    expect(await c).toBe('ok');
    expect(await payments.byOrderId('o1')).toMatchObject({
      status: 'Captured',
      paymentMethodToken: 'tok_visa',
    });
  });
});
