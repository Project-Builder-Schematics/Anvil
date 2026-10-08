/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { PaymentGateway } from '../domain/driven-ports/PaymentGateway';
import type { Payments } from '../domain/driven-ports/Payments';

export interface ChargePaymentCommand {}

export interface ChargePaymentResult {}

export type ChargePayment = (
  command: ChargePaymentCommand,
) => Promise<ChargePaymentResult>;

export const CHARGE_PAYMENT = Symbol('ChargePayment');

export const makeChargePayment =
  (payments: Payments, paymentGateway: PaymentGateway): ChargePayment =>
  () =>
    Promise.reject(new Error('ChargePayment is not implemented'));
