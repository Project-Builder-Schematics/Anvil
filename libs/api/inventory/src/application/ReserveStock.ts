/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';

export interface ReserveStockCommand {}

export interface ReserveStockResult {}

export type ReserveStock = (
  command: ReserveStockCommand,
) => Promise<ReserveStockResult>;

export const RESERVE_STOCK = Symbol('ReserveStock');

export const makeReserveStock =
  (stockItems: StockItems, reservations: Reservations): ReserveStock =>
  () =>
    Promise.reject(new Error('ReserveStock is not implemented'));
