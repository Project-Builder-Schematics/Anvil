/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars -- generated stub: the shapes and the body come from the feature */
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import type { ProductPrices } from '../domain/driven-ports/ProductPrices';

export interface AddOrderLineCommand {}

export interface AddOrderLineResult {}

export type AddOrderLine = (
  command: AddOrderLineCommand,
) => Promise<AddOrderLineResult>;

export const ADD_ORDER_LINE = Symbol('AddOrderLine');

export const makeAddOrderLine =
  (
    orderRepository: OrderRepository,
    productPrices: ProductPrices,
  ): AddOrderLine =>
  () =>
    Promise.reject(new Error('AddOrderLine is not implemented'));
