import { PaymentsError } from '../domain/errors';
import type { Payments } from '../domain/driven-ports/Payments';
import { toView, type PaymentView } from './PaymentView';

export interface RefundPaymentCommand {
  readonly orderId: string;
}

export type RefundPaymentResult = PaymentView;

export type RefundPayment = (
  command: RefundPaymentCommand,
) => Promise<RefundPaymentResult>;

export const REFUND_PAYMENT = Symbol('RefundPayment');

export const makeRefundPayment =
  (payments: Payments): RefundPayment =>
  async ({ orderId }) => {
    const payment = await payments.byOrderId(orderId);
    if (!payment) throw new PaymentsError('PAYMENT_NOT_REFUNDABLE');
    const refunded = payment.refund();
    await payments.save(refunded);
    return toView(refunded);
  };
