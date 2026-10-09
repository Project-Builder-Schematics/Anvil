export type OrderEvent =
  | { readonly type: 'OrderPaid'; readonly orderId: string }
  | { readonly type: 'OrderCancelled'; readonly orderId: string };
