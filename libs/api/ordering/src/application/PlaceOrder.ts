import { OrderingError, type OrderingErrorCode } from '../domain/errors';
import type { OrderStatus } from '../domain/Order';
import type { Charges } from '../domain/driven-ports/Charges';
import type { DomainEvents } from '../domain/driven-ports/DomainEvents';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import type { StockReservation } from '../domain/driven-ports/StockReservation';
import { findOrder } from './findOrder';

export interface PlaceOrderCommand {
  readonly orderId: string;
  readonly paymentMethodToken: string;
}

export interface PlaceOrderResult {
  readonly orderId: string;
  readonly status: OrderStatus;
}

export type PlaceOrder = (
  command: PlaceOrderCommand,
) => Promise<PlaceOrderResult>;

export const PLACE_ORDER = Symbol('PlaceOrder');

/**
 * Process manager (rules 12 to 14, 17). Only a refusal that leaves nothing behind compensates:
 * when the charge gives no answer the error propagates and the order stays Placed with its stock reserved.
 */
export const makePlaceOrder = (
  orderRepository: OrderRepository,
  stockReservation: StockReservation,
  charges: Charges,
  domainEvents: DomainEvents,
): PlaceOrder => {
  // A retry finds the order Placed while the run it retries is still going, so the runs of one order queue
  // here instead of overlapping. It holds within one API instance only.
  const running = new Map<string, Promise<PlaceOrderResult>>();

  const place = async ({
    orderId,
    paymentMethodToken,
  }: PlaceOrderCommand): Promise<PlaceOrderResult> => {
    const placed = (await findOrder(orderRepository, orderId)).place();
    await orderRepository.save(placed);

    const backToDraft = async (code: OrderingErrorCode): Promise<never> => {
      await orderRepository.save(placed.reopen());
      throw new OrderingError(code);
    };

    if (
      (await stockReservation.reserve(placed.id, placed.lines)) === 'OutOfStock'
    )
      return backToDraft('INSUFFICIENT_STOCK');
    if (
      (await charges.charge(placed.id, placed.total(), paymentMethodToken)) ===
      'Declined'
    ) {
      await stockReservation.release(placed.id);
      return backToDraft('PAYMENT_DECLINED');
    }
    await stockReservation.commit(placed.id);
    const paid = placed.pay();
    await orderRepository.save(paid);
    await domainEvents.publish({ type: 'OrderPaid', orderId });
    return { orderId: paid.id.value, status: paid.status };
  };

  return (command) => {
    const previous = running.get(command.orderId);
    const run = (previous ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => place(command));
    running.set(command.orderId, run);
    const settle = () => {
      if (running.get(command.orderId) === run) running.delete(command.orderId);
    };
    run.then(settle, settle);
    return run;
  };
};
