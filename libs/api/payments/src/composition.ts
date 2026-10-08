import { Module } from '@nestjs/common';
import { PAYMENTS } from './domain/driven-ports/Payments';
import { MemoryPayments } from './infrastructure/MemoryPayments';
import { PAYMENT_GATEWAY } from './domain/driven-ports/PaymentGateway';
import { MemoryPaymentGateway } from './infrastructure/MemoryPaymentGateway';
import { CHARGE_PAYMENT, makeChargePayment } from './application/ChargePayment';
import { REFUND_PAYMENT, makeRefundPayment } from './application/RefundPayment';

@Module({
  providers: [
    { provide: PAYMENTS, useClass: MemoryPayments },
    { provide: PAYMENT_GATEWAY, useClass: MemoryPaymentGateway },
    {
      provide: CHARGE_PAYMENT,
      useFactory: makeChargePayment,
      inject: [PAYMENTS, PAYMENT_GATEWAY],
    },
    {
      provide: REFUND_PAYMENT,
      useFactory: makeRefundPayment,
      inject: [PAYMENTS],
    },
  ],
  exports: [CHARGE_PAYMENT, REFUND_PAYMENT],
})
export class PaymentsModule {}
