import type { OrderId } from '../OrderId';
import type { OrderLine } from '../OrderLine';

export interface StockReservation {
  reserve(
    orderId: OrderId,
    lines: readonly OrderLine[],
  ): Promise<'Reserved' | 'OutOfStock'>;
  release(orderId: OrderId): Promise<void>;
  commit(orderId: OrderId): Promise<void>;
}

export const STOCK_RESERVATION = Symbol('StockReservation');
