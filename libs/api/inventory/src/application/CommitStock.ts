/* eslint-disable @typescript-eslint/no-unused-vars -- stub until the use case is implemented */
import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';

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
  () =>
    Promise.reject(new Error('CommitStock is not implemented'));
