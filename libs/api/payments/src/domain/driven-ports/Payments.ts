import type { Payment } from '../Payment';

export interface Payments {
  byOrderId(orderId: string): Promise<Payment | null>;
  save(payment: Payment): Promise<void>;
}

export const PAYMENTS = Symbol('Payments');
