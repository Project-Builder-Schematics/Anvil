import { OrderingError } from './errors';
import type { Money } from './Money';
import type { OrderId } from './OrderId';
import type { OrderLine } from './OrderLine';
import type { ProductId } from './ProductId';
import type { Quantity } from './Quantity';

export type OrderStatus = 'Draft' | 'Placed' | 'Cancelled';

const CANCELLABLE: readonly OrderStatus[] = ['Draft', 'Placed'];

export class Order {
  private constructor(
    readonly id: OrderId,
    readonly status: OrderStatus,
    readonly lines: readonly OrderLine[],
  ) {}

  static create(id: OrderId): Order {
    return new Order(id, 'Draft', []);
  }

  addLine(productId: ProductId, quantity: Quantity, unitPrice: Money): Order {
    this.assertDraft();
    const existing = this.lines.find((line) =>
      line.productId.equals(productId),
    );
    if (existing)
      return this.next(
        this.status,
        this.lines.map((line) =>
          line === existing
            ? { ...line, quantity: line.quantity.add(quantity) }
            : line,
        ),
      );
    const [first] = this.lines;
    if (first && first.unitPrice.currency !== unitPrice.currency)
      throw new OrderingError('CURRENCY_MISMATCH');
    return this.next(this.status, [
      ...this.lines,
      { productId, quantity, unitPrice },
    ]);
  }

  place(): Order {
    this.assertDraft();
    if (this.lines.length === 0) throw new OrderingError('ORDER_EMPTY');
    return this.next('Placed', this.lines);
  }

  cancel(): Order {
    if (!CANCELLABLE.includes(this.status))
      throw new OrderingError('ORDER_NOT_CANCELLABLE');
    return this.next('Cancelled', this.lines);
  }

  private assertDraft(): void {
    if (this.status !== 'Draft') throw new OrderingError('ORDER_NOT_EDITABLE');
  }

  private next(status: OrderStatus, lines: readonly OrderLine[]): Order {
    return new Order(this.id, status, lines);
  }
}
