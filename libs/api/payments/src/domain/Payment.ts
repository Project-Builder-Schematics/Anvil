import type { Amount } from './Amount';
import { PaymentsError } from './errors';

export type PaymentStatus = 'Pending' | 'Captured' | 'Failed' | 'Refunded';

export class Payment {
  private constructor(
    readonly id: string,
    readonly orderId: string,
    readonly amount: Amount,
    readonly currency: string,
    readonly paymentMethodToken: string,
    readonly status: PaymentStatus,
  ) {}

  static pending(
    id: string,
    orderId: string,
    amount: Amount,
    currency: string,
    paymentMethodToken: string,
  ): Payment {
    return new Payment(
      id,
      orderId,
      amount,
      currency,
      paymentMethodToken,
      'Pending',
    );
  }

  /** A refunded payment was charged once, so it still counts as the order's charge. */
  get isCharged(): boolean {
    return this.status === 'Captured' || this.status === 'Refunded';
  }

  capture(): Payment {
    return this.becomes('Captured');
  }

  fail(): Payment {
    return this.becomes('Failed');
  }

  refund(): Payment {
    if (this.status !== 'Captured')
      throw new PaymentsError('PAYMENT_NOT_REFUNDABLE');
    return this.becomes('Refunded');
  }

  private becomes(status: PaymentStatus): Payment {
    return new Payment(
      this.id,
      this.orderId,
      this.amount,
      this.currency,
      this.paymentMethodToken,
      status,
    );
  }
}
