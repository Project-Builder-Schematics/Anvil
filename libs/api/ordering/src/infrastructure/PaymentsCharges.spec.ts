import type { ChargePayment } from '@anvil/api-payments';
import { Money } from '../domain/Money';
import { OrderId } from '../domain/OrderId';
import { PaymentsCharges } from './PaymentsCharges';

const id = OrderId.of('o1');
const total = Money.of(9000, 'USD');
const refusal = (code: string) => Object.assign(new Error(code), { code });

describe('PaymentsCharges', () => {
  it('charges the total with the token in payments terms', async () => {
    const charge = vi.fn<ChargePayment>((command) =>
      Promise.resolve({
        orderId: command.orderId,
        status: 'Captured',
        amount: command.amount,
        currency: command.currency,
      }),
    );

    const outcome = await new PaymentsCharges(charge).charge(
      id,
      total,
      'tok_visa',
    );

    expect(outcome).toBe('Captured');
    expect(charge).toHaveBeenCalledWith({
      orderId: 'o1',
      amount: 9000,
      currency: 'USD',
      paymentMethodToken: 'tok_visa',
    });
  });

  it('answers Declined when payments refuses with PAYMENT_DECLINED', async () => {
    const charges = new PaymentsCharges(() =>
      Promise.reject(refusal('PAYMENT_DECLINED')),
    );
    expect(await charges.charge(id, total, 'tok_decline')).toBe('Declined');
  });

  it('answers Declined when payments refuses with INVALID_AMOUNT, as nothing was charged', async () => {
    const charges = new PaymentsCharges(() =>
      Promise.reject(refusal('INVALID_AMOUNT')),
    );
    expect(await charges.charge(id, total, 'tok_visa')).toBe('Declined');
  });

  it.each([
    ['another refusal', refusal('SOMETHING_ELSE')],
    ['a failure without a code', new Error('timeout')],
  ])('lets %s through, as the outcome is unknown', async (_name, error) => {
    const charges = new PaymentsCharges(() => Promise.reject(error));
    await expect(charges.charge(id, total, 'tok_visa')).rejects.toBe(error);
  });
});
