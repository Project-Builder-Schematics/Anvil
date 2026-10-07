import type { Money } from './money';

export type OrderStatus = 'Draft' | 'Placed' | 'Cancelled';

export interface OrderLine {
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export interface Order {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly lines: readonly OrderLine[];
}

export interface OrderStatusChange {
  readonly orderId: string;
  readonly status: OrderStatus;
}

export interface AddLine {
  readonly productId: string;
  readonly quantity: number;
}

/** Rule 2: the quantity of a line, inclusive. */
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 99;

export const lineTotal = ({ unitPrice, quantity }: OrderLine): Money => ({
  amount: unitPrice.amount * quantity,
  currency: unitPrice.currency,
});

/** Rule 7: one currency per order, so the first line names it. */
export const orderTotal = (lines: readonly OrderLine[]): Money | null => {
  const [first] = lines;
  if (!first) return null;
  return {
    amount: lines.reduce((sum, line) => sum + lineTotal(line).amount, 0),
    currency: first.unitPrice.currency,
  };
};

/** Rule 4. */
export const canEdit = ({ status }: Order): boolean => status === 'Draft';

/** Rules 6 and 10. */
export const canPlace = (order: Order): boolean =>
  canEdit(order) && order.lines.length > 0;

/** Rule 8. */
export const canCancel = ({ status }: Order): boolean =>
  status === 'Draft' || status === 'Placed';

export const withStatus = (order: Order, status: OrderStatus): Order => ({
  ...order,
  status,
});
