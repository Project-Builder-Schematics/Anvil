import type { OrderStatus } from '../domain/Order';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import { findOrder } from './findOrder';

export interface CancelOrderCommand {
  readonly orderId: string;
}

export interface CancelOrderResult {
  readonly orderId: string;
  readonly status: OrderStatus;
}

export type CancelOrder = (
  command: CancelOrderCommand,
) => Promise<CancelOrderResult>;

export const CANCEL_ORDER = Symbol('CancelOrder');

export const makeCancelOrder =
  (orderRepository: OrderRepository): CancelOrder =>
  async ({ orderId }) => {
    const cancelled = (await findOrder(orderRepository, orderId)).cancel();
    await orderRepository.save(cancelled);
    return { orderId: cancelled.id.value, status: cancelled.status };
  };
