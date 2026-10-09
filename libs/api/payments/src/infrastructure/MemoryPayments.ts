import { Injectable } from '@nestjs/common';
import type { Payment } from '../domain/Payment';
import type { Payments } from '../domain/driven-ports/Payments';

@Injectable()
export class MemoryPayments implements Payments {
  private readonly payments = new Map<string, Payment>();

  byOrderId(orderId: string): Promise<Payment | null> {
    return Promise.resolve(this.payments.get(orderId) ?? null);
  }

  save(payment: Payment): Promise<void> {
    const stored = this.payments.get(payment.orderId);
    if (!stored || stored.id === payment.id)
      this.payments.set(payment.orderId, payment);
    return Promise.resolve();
  }

  startCharge(pending: Payment): Promise<Payment> {
    const existing = this.payments.get(pending.orderId);
    if (existing && existing.status !== 'Failed')
      return Promise.resolve(existing);
    this.payments.set(pending.orderId, pending);
    return Promise.resolve(pending);
  }
}
