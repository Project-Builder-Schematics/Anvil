/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { Payments } from '../domain/driven-ports/Payments';

export interface RefundPaymentCommand {}

export interface RefundPaymentResult {}

export type RefundPayment = (
  command: RefundPaymentCommand,
) => Promise<RefundPaymentResult>;

export const REFUND_PAYMENT = Symbol('RefundPayment');

export const makeRefundPayment =
  (payments: Payments): RefundPayment =>
  () =>
    Promise.reject(new Error('RefundPayment is not implemented'));
