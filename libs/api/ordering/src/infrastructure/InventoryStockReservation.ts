import { Inject, Injectable } from '@nestjs/common';
import {
  COMMIT_STOCK,
  RELEASE_STOCK,
  RESERVE_STOCK,
  type CommitStock,
  type ReleaseStock,
  type ReserveStock,
} from '@demo/api-inventory';
import type { OrderId } from '../domain/OrderId';
import type { OrderLine } from '../domain/OrderLine';
import type { StockReservation } from '../domain/driven-ports/StockReservation';
import { refusalCode } from './refusalCode';

// Translates this port into inventory's language: the only file of the slice that knows its barrel.
@Injectable()
export class InventoryStockReservation implements StockReservation {
  constructor(
    @Inject(RESERVE_STOCK) private readonly reserveStock: ReserveStock,
    @Inject(RELEASE_STOCK) private readonly releaseStock: ReleaseStock,
    @Inject(COMMIT_STOCK) private readonly commitStock: CommitStock,
  ) {}

  async reserve(
    orderId: OrderId,
    lines: readonly OrderLine[],
  ): Promise<'Reserved' | 'OutOfStock'> {
    try {
      await this.reserveStock({
        orderId: orderId.value,
        lines: lines.map(({ productId, quantity }) => ({
          productId: productId.value,
          quantity: quantity.value,
        })),
      });
      return 'Reserved';
    } catch (error) {
      const code = refusalCode(error);
      if (code === 'INSUFFICIENT_STOCK' || code === 'PRODUCT_NOT_STOCKED')
        return 'OutOfStock';
      throw error;
    }
  }

  async release(orderId: OrderId): Promise<void> {
    await this.releaseStock({ orderId: orderId.value });
  }

  async commit(orderId: OrderId): Promise<void> {
    await this.commitStock({ orderId: orderId.value });
  }
}
