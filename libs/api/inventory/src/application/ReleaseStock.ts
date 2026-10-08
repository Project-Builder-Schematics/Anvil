/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { Reservations } from '../domain/driven-ports/Reservations';
import type { StockItems } from '../domain/driven-ports/StockItems';

export interface ReleaseStockCommand {}

export interface ReleaseStockResult {}

export type ReleaseStock = (
  command: ReleaseStockCommand,
) => Promise<ReleaseStockResult>;

export const RELEASE_STOCK = Symbol('ReleaseStock');

export const makeReleaseStock =
  (stockItems: StockItems, reservations: Reservations): ReleaseStock =>
  () =>
    Promise.reject(new Error('ReleaseStock is not implemented'));
