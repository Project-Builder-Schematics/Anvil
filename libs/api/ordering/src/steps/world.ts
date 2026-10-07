import { After, QuickPickleWorld, setWorldConstructor } from 'quickpickle';
import { makeAddOrderLine } from '../application/AddOrderLine';
import { makeCancelOrder } from '../application/CancelOrder';
import { makeCreateOrder } from '../application/CreateOrder';
import { makeGetOrder, type GetOrderResult } from '../application/GetOrder';
import { makePlaceOrder } from '../application/PlaceOrder';
import { OrderingError } from '../domain/errors';
import { MemoryOrderRepository } from '../infrastructure/MemoryOrderRepository';
import { MemoryProductPrices } from '../infrastructure/MemoryProductPrices';

export class OrderingWorld extends QuickPickleWorld {
  readonly prices = new MemoryProductPrices();
  private readonly orders = new MemoryOrderRepository();
  readonly createOrder = makeCreateOrder(this.orders);
  readonly addOrderLine = makeAddOrderLine(this.orders, this.prices);
  readonly placeOrder = makePlaceOrder(this.orders);
  readonly cancelOrder = makeCancelOrder(this.orders);
  readonly getOrder = makeGetOrder(this.orders);

  /** The order every step talks about. */
  currentId = '';
  readonly createdIds: string[] = [];
  /** Refusals no step has claimed yet; the After hook fails the scenario if any is left. */
  readonly refusals: OrderingError[] = [];
  shown: GetOrderResult | undefined;

  async newOrder(): Promise<void> {
    const { orderId } = await this.createOrder({});
    this.createdIds.push(orderId);
    this.currentId = orderId;
  }

  /** Runs a command; a business refusal is kept for "it is refused with", anything else fails the step. */
  async attempt<T>(run: () => Promise<T>): Promise<T | undefined> {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof OrderingError)) throw error;
      this.refusals.push(error);
      return undefined;
    }
  }
}

setWorldConstructor(OrderingWorld);

After((world: OrderingWorld) =>
  world.refusals.length === 0
    ? Promise.resolve()
    : Promise.reject(
        new Error(
          `unclaimed refusals: ${world.refusals.map((r) => r.code).join(', ')}`,
        ),
      ),
);

export const rowsOf = (lines: GetOrderResult['lines']) =>
  lines.map((line) => ({
    product: line.productId,
    quantity: String(line.quantity),
    'unit price': `${String(line.unitPrice.amount)} ${line.unitPrice.currency}`,
  }));
