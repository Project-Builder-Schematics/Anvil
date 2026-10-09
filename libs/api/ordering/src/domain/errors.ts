export const ORDERING_ERROR = {
  QUANTITY_OUT_OF_RANGE: 'ordering.quantity_out_of_range',
  ORDER_NOT_EDITABLE: 'ordering.order_not_editable',
  PRODUCT_NOT_FOUND: 'ordering.product_not_found',
  ORDER_EMPTY: 'ordering.order_empty',
  CURRENCY_MISMATCH: 'ordering.currency_mismatch',
  ORDER_NOT_CANCELLABLE: 'ordering.order_not_cancellable',
  ORDER_NOT_FOUND: 'ordering.order_not_found',
  INSUFFICIENT_STOCK: 'ordering.insufficient_stock',
  PAYMENT_DECLINED: 'ordering.payment_declined',
} as const;

export type OrderingErrorCode = keyof typeof ORDERING_ERROR;

export class OrderingError extends Error {
  constructor(readonly code: OrderingErrorCode) {
    super(ORDERING_ERROR[code]);
    this.name = 'OrderingError';
  }
}
