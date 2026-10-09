export const PAYMENTS_ERROR = {
  INVALID_AMOUNT: 'payments.invalid_amount',
  PAYMENT_DECLINED: 'payments.payment_declined',
  PAYMENT_NOT_REFUNDABLE: 'payments.payment_not_refundable',
} as const;

export type PaymentsErrorCode = keyof typeof PAYMENTS_ERROR;

export class PaymentsError extends Error {
  constructor(readonly code: PaymentsErrorCode) {
    super(PAYMENTS_ERROR[code]);
    this.name = 'PaymentsError';
  }
}
