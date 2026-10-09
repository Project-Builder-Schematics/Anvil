import type { Money } from '../Money';
import type { ProductId } from '../ProductId';

export interface ProductPrices {
  priceOf(productId: ProductId): Promise<Money | null>;
}

export const PRODUCT_PRICES = Symbol('ProductPrices');
