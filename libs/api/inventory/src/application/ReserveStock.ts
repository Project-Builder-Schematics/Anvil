/* eslint-disable @typescript-eslint/no-unused-vars -- stub until the use case is implemented */
import type { ReservationLine } from '../domain/Reservation';
import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';

export interface ReserveStockCommand {
  readonly orderId: string;
  readonly lines: readonly ReservationLine[];
}

export interface ReserveStockResult {
  readonly orderId: string;
  readonly lines: readonly ReservationLine[];
}

export type ReserveStock = (
  command: ReserveStockCommand,
) => Promise<ReserveStockResult>;

export const RESERVE_STOCK = Symbol('ReserveStock');

export const makeReserveStock =
  (stockItems: StockItems, reservations: Reservations): ReserveStock =>
  () =>
    Promise.reject(new Error('ReserveStock is not implemented'));
