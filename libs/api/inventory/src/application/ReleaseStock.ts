import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';
import { settle } from './settle';

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
  ({ orderId }) =>
    settle(stockItems, reservations, orderId, 'release');
