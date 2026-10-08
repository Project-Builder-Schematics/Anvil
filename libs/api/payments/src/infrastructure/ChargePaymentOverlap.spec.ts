import { MemoryPayments } from './MemoryPayments';
import type {
  ChargeOutcome,
  PaymentGateway,
} from '../domain/driven-ports/PaymentGateway';
import { makeChargePayment } from '../application/ChargePayment';

/** A gateway whose answers the test releases one by one, in the order it chooses. */
const heldGateway = () => {
  const releases: ((outcome: ChargeOutcome) => void)[] = [];
  const gateway: PaymentGateway = {
    charge: () =>
      new Promise<ChargeOutcome>((resolve) => releases.push(resolve)),
  };
  return {
    gateway,
    release: (i: number, outcome: ChargeOutcome) => releases[i]?.(outcome),
  };
};

const command = (paymentMethodToken: string) => ({
  orderId: 'o1',
  amount: 4500,
  currency: 'USD',
  paymentMethodToken,
});

const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    () => 'refused',
  );

describe('ChargePayment over MemoryPayments, charges that overlap', () => {
  it('lets the late decline of a replaced payment leave the new pending one alone', async () => {
    const payments = new MemoryPayments();
    const { gateway, release } = heldGateway();
    const charge = makeChargePayment(payments, gateway);

    const a = settle(charge(command('tok_decline')));
    const b = settle(charge(command('tok_decline')));
    await Promise.resolve();
    release(0, 'Declined');
    expect(await a).toBe('refused');

    const c = settle(charge(command('tok_visa')));
    await Promise.resolve();
    release(1, 'Declined');
    expect(await b).toBe('refused');
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
