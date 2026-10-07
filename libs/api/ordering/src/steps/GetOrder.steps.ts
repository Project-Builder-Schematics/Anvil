import { Then, When, type DataTable } from 'quickpickle';
import { expect } from 'vitest';
import { rowsOf, type OrderingWorld } from './world';

When('the order is requested', async (world: OrderingWorld) => {
  world.shown = await world.attempt(() =>
    world.getOrder({ orderId: world.currentId }),
  );
});

Then('the order shown is {string}', (world: OrderingWorld, status: string) => {
  expect(world.shown?.status).toBe(status);
});

Then('the order shown lists no lines', (world: OrderingWorld) => {
  expect(world.shown?.lines).toEqual([]);
});

Then(
  'the order shown has the lines',
  (world: OrderingWorld, table: DataTable) => {
    expect(rowsOf(world.shown?.lines ?? [])).toEqual(table.hashes());
  },
);
