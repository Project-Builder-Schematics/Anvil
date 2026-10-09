import { InventoryError } from './errors';
import type { StockLevel } from './StockLevel';

/** Immutable; `reserved <= onHand` holds in every instance. */
export class StockItem {
  private constructor(
    readonly productId: string,
    readonly onHand: number,
    readonly reserved: number,
  ) {}

  static create(productId: string, level: StockLevel): StockItem {
    return new StockItem(productId, level.value, 0);
  }

  reserve(quantity: number): StockItem {
    if (quantity > this.onHand - this.reserved)
      throw new InventoryError('INSUFFICIENT_STOCK');
    return new StockItem(this.productId, this.onHand, this.reserved + quantity);
  }

  release(quantity: number): StockItem {
    return new StockItem(this.productId, this.onHand, this.reserved - quantity);
  }

  commit(quantity: number): StockItem {
    return new StockItem(
      this.productId,
      this.onHand - quantity,
      this.reserved - quantity,
    );
  }

  setLevel(level: StockLevel): StockItem {
    if (level.value < this.reserved)
      throw new InventoryError('STOCK_LEVEL_INVALID');
    return new StockItem(this.productId, level.value, this.reserved);
  }
}
