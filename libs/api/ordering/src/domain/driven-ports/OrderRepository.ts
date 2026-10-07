import type { Order } from '../Order';
import type { OrderId } from '../OrderId';

export interface OrderRepository {
  nextId(): OrderId;
  byId(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

export const ORDER_REPOSITORY = Symbol('OrderRepository');
