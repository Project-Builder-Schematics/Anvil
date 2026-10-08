/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';

export interface CommitStockCommand {}

export interface CommitStockResult {}

export type CommitStock = (
  command: CommitStockCommand,
) => Promise<CommitStockResult>;

export const COMMIT_STOCK = Symbol('CommitStock');

export const makeCommitStock =
  (stockItems: StockItems, reservations: Reservations): CommitStock =>
  () =>
    Promise.reject(new Error('CommitStock is not implemented'));
