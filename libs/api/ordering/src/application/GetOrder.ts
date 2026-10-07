/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';

export interface GetOrderCommand {}

export interface GetOrderResult {}

export type GetOrder = (command: GetOrderCommand) => Promise<GetOrderResult>;

export const GET_ORDER = Symbol('GetOrder');

export const makeGetOrder =
  (orderRepository: OrderRepository): GetOrder =>
  () =>
    Promise.reject(new Error('GetOrder is not implemented'));
