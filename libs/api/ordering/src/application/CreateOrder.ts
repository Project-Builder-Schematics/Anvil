/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';

export interface CreateOrderCommand {}

export interface CreateOrderResult {}

export type CreateOrder = (
  command: CreateOrderCommand,
) => Promise<CreateOrderResult>;

export const CREATE_ORDER = Symbol('CreateOrder');

export const makeCreateOrder =
  (orderRepository: OrderRepository): CreateOrder =>
  () =>
    Promise.reject(new Error('CreateOrder is not implemented'));
