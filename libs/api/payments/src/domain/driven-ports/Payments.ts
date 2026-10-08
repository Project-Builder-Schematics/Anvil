import type { Payment } from '../Payment';

export interface Payments {
  byOrderId(orderId: string): Promise<Payment | null>;
  /** Stores the payment unless the order holds one with another id, so a stale save changes nothing. */
  save(payment: Payment): Promise<void>;
  /** Answers the order's payment unless it has none or it is `Failed`; then stores `pending` and answers it, as one step. */
  startCharge(pending: Payment): Promise<Payment>;
}

export const PAYMENTS = Symbol('Payments');
