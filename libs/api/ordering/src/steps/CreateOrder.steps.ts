import { Then, When } from 'quickpickle';
import { expect } from 'vitest';
import type { OrderingWorld } from './world';

When('an order is created', (world: OrderingWorld) => world.newOrder());

Then('the order is {string}', async (world: OrderingWorld, status: string) => {
  const order = await world.getOrder({ orderId: world.currentId });
  expect(order.status).toBe(status);
});

Then('the order has no lines', async (world: OrderingWorld) => {
  const order = await world.getOrder({ orderId: world.currentId });
  expect(order.lines).toEqual([]);
});

Then('the two orders have different ids', (world: OrderingWorld) => {
  expect(world.createdIds).toHaveLength(2);
  expect(new Set(world.createdIds).size).toBe(2);
});
