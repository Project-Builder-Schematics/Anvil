import { Reservation, type ReservationLine } from '../domain/Reservation';
import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';
import { findLineItems } from './findItem';

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
  async ({ orderId, lines }) => {
    const existing = await reservations.byOrderId(orderId);
    if (existing && existing.status !== 'Released') return existing;

    const reserved = (await findLineItems(stockItems, lines)).map(
      ({ line, item }) => item.reserve(line.quantity),
    );
    await Promise.all(reserved.map((item) => stockItems.save(item)));
    const reservation = Reservation.hold(orderId, lines);
    await reservations.save(reservation);
    return reservation;
  };
