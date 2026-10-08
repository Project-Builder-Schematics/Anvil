import { Injectable } from '@nestjs/common';
import { StockItem } from '../domain/StockItem';
import { StockLevel } from '../domain/StockLevel';
import type { StockItems } from '../domain/driven-ports/StockItems';

// The products ordering's MemoryProductPrices knows.
const DEMO_PRODUCTS = ['keyboard', 'mouse', 'monitor'];

@Injectable()
export class MemoryStockItems implements StockItems {
  private readonly items = new Map<string, StockItem>(
    DEMO_PRODUCTS.map((productId) => [
      productId,
      StockItem.create(productId, StockLevel.of(50)),
    ]),
  );

  byId(productId: string): Promise<StockItem | null> {
    return Promise.resolve(this.items.get(productId) ?? null);
  }

  save(item: StockItem): Promise<void> {
    this.items.set(item.productId, item);
    return Promise.resolve();
  }
}
