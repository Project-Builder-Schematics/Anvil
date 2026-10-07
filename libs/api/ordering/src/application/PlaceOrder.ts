import type { OrderStatus } from '../domain/Order';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import { findOrder } from './findOrder';

export interface PlaceOrderCommand {
  readonly orderId: string;
}

export interface PlaceOrderResult {
  readonly orderId: string;
  readonly status: OrderStatus;
}

export type PlaceOrder = (
  command: PlaceOrderCommand,
) => Promise<PlaceOrderResult>;

export const PLACE_ORDER = Symbol('PlaceOrder');

export const makePlaceOrder =
  (orderRepository: OrderRepository): PlaceOrder =>
  async ({ orderId }) => {
    const placed = (await findOrder(orderRepository, orderId)).place();
    await orderRepository.save(placed);
    return { orderId: placed.id.value, status: placed.status };
  };
