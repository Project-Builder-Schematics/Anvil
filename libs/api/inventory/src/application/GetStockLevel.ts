import type { StockItems } from '../domain/driven-ports/StockItems';
import { findItem } from './findItem';
import { toView, type StockLevelView } from './StockLevelView';

export interface GetStockLevelCommand {
  readonly productId: string;
}

export type GetStockLevelResult = StockLevelView;

export type GetStockLevel = (
  command: GetStockLevelCommand,
) => Promise<GetStockLevelResult>;

export const GET_STOCK_LEVEL = Symbol('GetStockLevel');

export const makeGetStockLevel =
  (stockItems: StockItems): GetStockLevel =>
  async ({ productId }) =>
    toView(await findItem(stockItems, productId));
