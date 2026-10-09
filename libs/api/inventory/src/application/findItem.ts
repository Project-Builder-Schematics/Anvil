import { InventoryError } from '../domain/errors';
import type { ReservationLine } from '../domain/Reservation';
import type { StockItem } from '../domain/StockItem';
import type { StockItems } from '../domain/driven-ports/StockItems';

export const findItem = async (
  stockItems: StockItems,
  productId: string,
): Promise<StockItem> => {
  const item = await stockItems.byId(productId);
  if (!item) throw new InventoryError('PRODUCT_NOT_STOCKED');
  return item;
};

/** Every line with its item; a missing item refuses before any line is applied. */
export const findLineItems = (
  stockItems: StockItems,
  lines: readonly ReservationLine[],
): Promise<{ line: ReservationLine; item: StockItem }[]> =>
  Promise.all(
    lines.map(async (line) => ({
      line,
      item: await findItem(stockItems, line.productId),
    })),
  );
