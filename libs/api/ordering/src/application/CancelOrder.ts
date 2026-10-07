/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';

export interface CancelOrderCommand {}

export interface CancelOrderResult {}

export type CancelOrder = (
  command: CancelOrderCommand,
) => Promise<CancelOrderResult>;

export const CANCEL_ORDER = Symbol('CancelOrder');

export const makeCancelOrder =
  (orderRepository: OrderRepository): CancelOrder =>
  () =>
    Promise.reject(new Error('CancelOrder is not implemented'));
