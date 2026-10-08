/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { StockItems } from '../domain/driven-ports/StockItems';

export interface SetStockLevelCommand {}

export interface SetStockLevelResult {}

export type SetStockLevel = (
  command: SetStockLevelCommand,
) => Promise<SetStockLevelResult>;

export const SET_STOCK_LEVEL = Symbol('SetStockLevel');

export const makeSetStockLevel =
  (stockItems: StockItems): SetStockLevel =>
  () =>
    Promise.reject(new Error('SetStockLevel is not implemented'));
