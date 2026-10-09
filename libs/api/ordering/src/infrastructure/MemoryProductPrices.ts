import { Injectable } from '@nestjs/common';
import { Money } from '../domain/Money';
import type { ProductId } from '../domain/ProductId';
import type { ProductPrices } from '../domain/driven-ports/ProductPrices';

@Injectable()
export class MemoryProductPrices implements ProductPrices {
  private readonly prices = new Map<string, Money>([
    ['keyboard', Money.of(4500, 'USD')],
    ['mouse', Money.of(2500, 'USD')],
    ['monitor', Money.of(21900, 'USD')],
  ]);

  set(productId: ProductId, price: Money): void {
    this.prices.set(productId.value, price);
  }

  priceOf(productId: ProductId): Promise<Money | null> {
    return Promise.resolve(this.prices.get(productId.value) ?? null);
  }
}
