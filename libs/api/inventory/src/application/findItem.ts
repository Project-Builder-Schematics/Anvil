import { InventoryError } from '../domain/errors';
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
