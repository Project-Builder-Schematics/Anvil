import { StockItem } from '../domain/StockItem';
import { StockLevel } from '../domain/StockLevel';
import type { StockItems } from '../domain/driven-ports/StockItems';
import { toView, type StockLevelView } from './StockLevelView';

export interface SetStockLevelCommand {
  readonly productId: string;
  readonly onHand: number;
}

export type SetStockLevelResult = StockLevelView;

export type SetStockLevel = (
  command: SetStockLevelCommand,
) => Promise<SetStockLevelResult>;

export const SET_STOCK_LEVEL = Symbol('SetStockLevel');

export const makeSetStockLevel =
  (stockItems: StockItems): SetStockLevel =>
  async ({ productId, onHand }) => {
    const level = StockLevel.of(onHand);
    const current = await stockItems.byId(productId);
    const item = current
      ? current.setLevel(level)
      : StockItem.create(productId, level);
    await stockItems.save(item);
    return toView(item);
  };
