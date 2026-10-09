import type { StockItem } from '../StockItem';

export interface StockItems {
  byId(productId: string): Promise<StockItem | null>;
  save(item: StockItem): Promise<void>;
}

export const STOCK_ITEMS = Symbol('StockItems');
