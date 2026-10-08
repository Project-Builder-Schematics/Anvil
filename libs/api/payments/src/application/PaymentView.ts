import type { Payment } from '../domain/Payment';

export interface PaymentView {
  readonly orderId: string;
  readonly status: Payment['status'];
  readonly amount: number;
  readonly currency: string;
}

export const toView = ({
  orderId,
  status,
  amount,
  currency,
}: Payment): PaymentView => ({
  orderId,
  status,
  amount: amount.value,
  currency,
});
