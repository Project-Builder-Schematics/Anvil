/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { StockItems } from '../domain/driven-ports/StockItems';

export interface GetStockLevelCommand {}

export interface GetStockLevelResult {}

export type GetStockLevel = (
  command: GetStockLevelCommand,
) => Promise<GetStockLevelResult>;

export const GET_STOCK_LEVEL = Symbol('GetStockLevel');

export const makeGetStockLevel =
  (stockItems: StockItems): GetStockLevel =>
  () =>
    Promise.reject(new Error('GetStockLevel is not implemented'));
