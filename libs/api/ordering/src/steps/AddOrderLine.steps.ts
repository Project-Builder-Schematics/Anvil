import { Given, Then, When, type DataTable } from 'quickpickle';
import { expect } from 'vitest';
import { Money } from '../domain/Money';
import { ProductId } from '../domain/ProductId';
import { rowsOf, type OrderingWorld } from './world';

Given(
  'the catalog prices {string} at {int} {string}',
  (world: OrderingWorld, product: string, amount: number, currency: string) => {
    world.prices.set(ProductId.of(product), Money.of(amount, currency));
  },
);

Given('a draft order', (world: OrderingWorld) => world.newOrder());

When(
  '{int} of {string} is added to the order',
  async (world: OrderingWorld, quantity: number, product: string) => {
    await world.attempt(() =>
      world.addOrderLine({
        orderId: world.currentId,
        productId: product,
        quantity,
      }),
    );
  },
);

Then('the order lines are', async (world: OrderingWorld, table: DataTable) => {
  const order = await world.getOrder({ orderId: world.currentId });
  expect(rowsOf(order.lines)).toEqual(table.hashes());
});

Then('it is refused with {string}', (world: OrderingWorld, code: string) => {
  expect(world.refusals.pop()?.code).toBe(code);
});

Given('the order has been cancelled', async (world: OrderingWorld) => {
  await world.attempt(() => world.cancelOrder({ orderId: world.currentId }));
});

Given('an order id that names no order', (world: OrderingWorld) => {
  world.currentId = 'missing-order';
});
