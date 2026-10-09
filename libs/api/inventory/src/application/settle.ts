import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';
import { findLineItems } from './findItem';

/** Applies `action` to a held reservation and to its stock; any other reservation, or none, is left as it is. */
export const settle = async (
  stockItems: StockItems,
  reservations: Reservations,
  orderId: string,
  action: 'release' | 'commit',
): Promise<Record<string, never>> => {
  const reservation = await reservations.byOrderId(orderId);
  if (!reservation?.isHeld) return {};
  const settled = (await findLineItems(stockItems, reservation.lines)).map(
    ({ line, item }) => item[action](line.quantity),
  );
  await Promise.all(settled.map((item) => stockItems.save(item)));
  await reservations.save(reservation[action]());
  return {};
};
