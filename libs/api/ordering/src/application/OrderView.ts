import type { Order, OrderStatus } from '../domain/Order';

export interface OrderView {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly lines: readonly {
    readonly productId: string;
    readonly quantity: number;
    readonly unitPrice: { readonly amount: number; readonly currency: string };
  }[];
}

export const toView = (order: Order): OrderView => ({
  orderId: order.id.value,
  status: order.status,
  lines: order.lines.map((line) => ({
    productId: line.productId.value,
    quantity: line.quantity.value,
    unitPrice: {
      amount: line.unitPrice.amount,
      currency: line.unitPrice.currency,
    },
  })),
});
