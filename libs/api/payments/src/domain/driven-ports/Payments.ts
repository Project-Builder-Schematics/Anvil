import type { Payment } from '../Payment';

export interface Payments {
  byOrderId(orderId: string): Promise<Payment | null>;
  save(payment: Payment): Promise<void>;
  /** Answers the order's payment unless it has none or it is `Failed`; then stores `pending` and answers it, as one step. */
  startCharge(pending: Payment): Promise<Payment>;
}

export const PAYMENTS = Symbol('Payments');
