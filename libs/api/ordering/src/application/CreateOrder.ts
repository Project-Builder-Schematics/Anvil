import { Order } from '../domain/Order';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';

export type CreateOrderCommand = Record<string, never>;

export interface CreateOrderResult {
  readonly orderId: string;
}

export type CreateOrder = (
  command: CreateOrderCommand,
) => Promise<CreateOrderResult>;

export const CREATE_ORDER = Symbol('CreateOrder');

export const makeCreateOrder =
  (orderRepository: OrderRepository): CreateOrder =>
  async () => {
    const order = Order.create(orderRepository.nextId());
    await orderRepository.save(order);
    return { orderId: order.id.value };
  };
