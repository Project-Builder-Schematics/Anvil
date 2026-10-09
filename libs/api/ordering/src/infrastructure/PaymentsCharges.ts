import { Inject, Injectable } from '@nestjs/common';
import { CHARGE_PAYMENT, type ChargePayment } from '@demo/api-payments';
import type { Money } from '../domain/Money';
import type { OrderId } from '../domain/OrderId';
import type { Charges } from '../domain/driven-ports/Charges';
import { refusalCode } from './refusalCode';

// Translates this port into payments' language: the only file of the slice that knows its barrel.
@Injectable()
export class PaymentsCharges implements Charges {
  constructor(
    @Inject(CHARGE_PAYMENT) private readonly chargePayment: ChargePayment,
  ) {}

  async charge(
    orderId: OrderId,
    total: Money,
    paymentMethodToken: string,
  ): Promise<'Captured' | 'Declined'> {
    try {
      await this.chargePayment({
        orderId: orderId.value,
        amount: total.amount,
        currency: total.currency,
        paymentMethodToken,
      });
      return 'Captured';
    } catch (error) {
      // INVALID_AMOUNT is checked before anything is stored or sent, so its outcome is known (rule 21).
      const code = refusalCode(error);
      if (code === 'PAYMENT_DECLINED' || code === 'INVALID_AMOUNT')
        return 'Declined';
      throw error;
    }
  }
}
