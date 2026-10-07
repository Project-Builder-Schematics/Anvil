import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import { findOrder } from './findOrder';
import { toView, type OrderView } from './OrderView';

export interface GetOrderCommand {
  readonly orderId: string;
}

export type GetOrderResult = OrderView;

export type GetOrder = (command: GetOrderCommand) => Promise<GetOrderResult>;

export const GET_ORDER = Symbol('GetOrder');

export const makeGetOrder =
  (orderRepository: OrderRepository): GetOrder =>
  async ({ orderId }) =>
    toView(await findOrder(orderRepository, orderId));
