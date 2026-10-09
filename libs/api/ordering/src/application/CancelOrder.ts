import type { OrderStatus } from '../domain/Order';
import type { DomainEvents } from '../domain/driven-ports/DomainEvents';
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
  (orderRepository: OrderRepository, domainEvents: DomainEvents): CancelOrder =>
  async ({ orderId }) => {
    const cancelled = (await findOrder(orderRepository, orderId)).cancel();
    await orderRepository.save(cancelled);
    await domainEvents.publish({ type: 'OrderCancelled', orderId });
    return { orderId: cancelled.id.value, status: cancelled.status };
  };
