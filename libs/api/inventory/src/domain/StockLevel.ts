import { InventoryError } from './errors';

export class StockLevel {
  private constructor(readonly value: number) {}

  static of(value: number): StockLevel {
    if (!Number.isInteger(value) || value < 0)
      throw new InventoryError('STOCK_LEVEL_INVALID');
    return new StockLevel(value);
  }
}
