/* eslint-disable @typescript-eslint/no-unused-vars -- stub until the use case is implemented */
import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';

export interface ReleaseStockCommand {
  readonly orderId: string;
}

export type ReleaseStockResult = Record<string, never>;

export type ReleaseStock = (
  command: ReleaseStockCommand,
) => Promise<ReleaseStockResult>;

export const RELEASE_STOCK = Symbol('ReleaseStock');

export const makeReleaseStock =
  (stockItems: StockItems, reservations: Reservations): ReleaseStock =>
  () =>
    Promise.reject(new Error('ReleaseStock is not implemented'));
