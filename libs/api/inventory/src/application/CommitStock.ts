import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';
import { settle } from './settle';

export interface CommitStockCommand {
  readonly orderId: string;
}

export type CommitStockResult = Record<string, never>;

export type CommitStock = (
  command: CommitStockCommand,
) => Promise<CommitStockResult>;

export const COMMIT_STOCK = Symbol('CommitStock');

export const makeCommitStock =
  (stockItems: StockItems, reservations: Reservations): CommitStock =>
  ({ orderId }) =>
    settle(stockItems, reservations, orderId, 'commit');
