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
    this.payments.set(payment.orderId, payment);
    return Promise.resolve();
  }
}
