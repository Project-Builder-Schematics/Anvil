import { randomUUID } from 'node:crypto';
import { Amount } from '../domain/Amount';
import { Payment } from '../domain/Payment';
import { PaymentsError } from '../domain/errors';
import type { PaymentGateway } from '../domain/driven-ports/PaymentGateway';
import type { Payments } from '../domain/driven-ports/Payments';
import { toView, type PaymentView } from './PaymentView';

export interface ChargePaymentCommand {
  readonly orderId: string;
  readonly amount: number;
  readonly currency: string;
  readonly paymentMethodToken: string;
}

export type ChargePaymentResult = PaymentView;

export type ChargePayment = (
  command: ChargePaymentCommand,
) => Promise<ChargePaymentResult>;

export const CHARGE_PAYMENT = Symbol('ChargePayment');

export const makeChargePayment =
  (payments: Payments, paymentGateway: PaymentGateway): ChargePayment =>
  async ({ orderId, amount, currency, paymentMethodToken }) => {
    const started = await payments.startCharge(
      Payment.pending(
        randomUUID(),
        orderId,
        Amount.of(amount),
        currency,
        paymentMethodToken,
      ),
    );
    if (started.isCharged) return toView(started);

    // A Pending retry resolves with the request it stored, not the retry's own.
    const outcome = await paymentGateway.charge({
      amount: started.amount.value,
      currency: started.currency,
      paymentMethodToken: started.paymentMethodToken,
      idempotencyKey: started.id,
    });
    if (outcome === 'Declined') {
      await payments.save(started.fail());
      throw new PaymentsError('PAYMENT_DECLINED');
    }
    const captured = started.capture();
    await payments.save(captured);
    return toView(captured);
  };
