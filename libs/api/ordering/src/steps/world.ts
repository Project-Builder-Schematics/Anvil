import { After, QuickPickleWorld, setWorldConstructor } from 'quickpickle';
import { makeAddOrderLine } from '../application/AddOrderLine';
import { makeCancelOrder } from '../application/CancelOrder';
import { makeCreateOrder } from '../application/CreateOrder';
import { makeGetOrder, type GetOrderResult } from '../application/GetOrder';
import { makePlaceOrder } from '../application/PlaceOrder';
import { OrderingError } from '../domain/errors';
import { MemoryOrderRepository } from '../infrastructure/MemoryOrderRepository';
import { MemoryDomainEvents } from '../infrastructure/MemoryDomainEvents';
import { MemoryProductPrices } from '../infrastructure/MemoryProductPrices';
import { FakeCharges, FakeStockReservation, NoAnswer } from './fakes';

export class OrderingWorld extends QuickPickleWorld {
  readonly prices = new MemoryProductPrices();
  private readonly orders = new MemoryOrderRepository();
  readonly createOrder = makeCreateOrder(this.orders);
  readonly addOrderLine = makeAddOrderLine(this.orders, this.prices);
  readonly stock = new FakeStockReservation();
  readonly charges = new FakeCharges();
  readonly events = new MemoryDomainEvents();
  readonly placeOrder = makePlaceOrder(
    this.orders,
    this.stock,
    this.charges,
    this.events,
  );
  readonly cancelOrder = makeCancelOrder(this.orders, this.events);
  readonly getOrder = makeGetOrder(this.orders);

  /** The order every step talks about. */
  currentId = '';
  readonly createdIds: string[] = [];
  /** Refusals no step has claimed yet; the After hook fails the scenario if any is left. */
  readonly refusals: OrderingError[] = [];
  /** Charges that gave no answer and that a step has not claimed yet. */
  noAnswers = 0;
  shown: GetOrderResult | undefined;

  async newOrder(): Promise<void> {
    const { orderId } = await this.createOrder({});
    this.createdIds.push(orderId);
    this.currentId = orderId;
  }

  /** Runs a command; a business refusal is kept for "it is refused with" and a charge with no answer for "payments gave no answer", anything else fails the step. */
  async attempt<T>(run: () => Promise<T>): Promise<T | undefined> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof NoAnswer) {
        this.noAnswers += 1;
        return undefined;
      }
      if (!(error instanceof OrderingError)) throw error;
      this.refusals.push(error);
      return undefined;
    }
  }
}

setWorldConstructor(OrderingWorld);

After((world: OrderingWorld) => {
  const unclaimed = [
    ...world.refusals.map((r) => r.code),
    ...(world.noAnswers > 0 ? ['no answer from payments'] : []),
  ];
  return unclaimed.length === 0
    ? Promise.resolve()
    : Promise.reject(new Error(`unclaimed: ${unclaimed.join(', ')}`));
});

export const rowsOf = (lines: GetOrderResult['lines']) =>
  lines.map((line) => ({
    product: line.productId,
    quantity: String(line.quantity),
    'unit price': `${String(line.unitPrice.amount)} ${line.unitPrice.currency}`,
  }));
