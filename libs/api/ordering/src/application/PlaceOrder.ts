/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';

export interface PlaceOrderCommand {}

export interface PlaceOrderResult {}

export type PlaceOrder = (
  command: PlaceOrderCommand,
) => Promise<PlaceOrderResult>;

export const PLACE_ORDER = Symbol('PlaceOrder');

export const makePlaceOrder =
  (orderRepository: OrderRepository): PlaceOrder =>
  () =>
    Promise.reject(new Error('PlaceOrder is not implemented'));
