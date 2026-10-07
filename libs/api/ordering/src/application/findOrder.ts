import { OrderingError } from '../domain/errors';
import type { Order } from '../domain/Order';
import { OrderId } from '../domain/OrderId';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';

export const findOrder = async (
  orderRepository: OrderRepository,
  orderId: string,
): Promise<Order> => {
  const order = await orderRepository.byId(OrderId.of(orderId));
  if (!order) throw new OrderingError('ORDER_NOT_FOUND');
  return order;
};
