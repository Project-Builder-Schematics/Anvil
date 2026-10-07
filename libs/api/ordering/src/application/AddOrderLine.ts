import { OrderingError } from '../domain/errors';
import { ProductId } from '../domain/ProductId';
import { Quantity } from '../domain/Quantity';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import type { ProductPrices } from '../domain/driven-ports/ProductPrices';
import { findOrder } from './findOrder';
import { toView, type OrderView } from './OrderView';

export interface AddOrderLineCommand {
  readonly orderId: string;
  readonly productId: string;
  readonly quantity: number;
}

export type AddOrderLineResult = OrderView;

export type AddOrderLine = (
  command: AddOrderLineCommand,
) => Promise<AddOrderLineResult>;

export const ADD_ORDER_LINE = Symbol('AddOrderLine');

export const makeAddOrderLine =
  (
    orderRepository: OrderRepository,
    productPrices: ProductPrices,
  ): AddOrderLine =>
  async ({ orderId, productId, quantity }) => {
    const order = await findOrder(orderRepository, orderId);
    const wanted = Quantity.of(quantity);
    const product = ProductId.of(productId);
    const price = await productPrices.priceOf(product);
    if (!price) throw new OrderingError('PRODUCT_NOT_FOUND');
    const updated = order.addLine(product, wanted, price);
    await orderRepository.save(updated);
    return toView(updated);
  };
