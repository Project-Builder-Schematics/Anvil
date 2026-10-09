import type { Money } from './Money';
import type { ProductId } from './ProductId';
import type { Quantity } from './Quantity';

export interface OrderLine {
  readonly productId: ProductId;
  readonly quantity: Quantity;
  readonly unitPrice: Money;
}
