import { Given, Then, When, type DataTable } from 'quickpickle';
import { expect } from 'vitest';
import type { InventoryWorld } from './world';

Given(
  'the stock level of {string} is set to {int}',
  async (world: InventoryWorld, productId: string, onHand: number) => {
    await world.attempt(() => world.setStockLevel({ productId, onHand }));
  },
);

When(
  'the lines of order {string} are reserved',
  async (world: InventoryWorld, orderId: string, table: DataTable) => {
    const lines = table.hashes().map((row) => ({
      productId: row['product'] ?? '',
      quantity: Number(row['quantity']),
    }));
    world.reservation = await world.attempt(() =>
      world.reserveStock({ orderId, lines }),
    );
  },
);

Then(
  'the stock of {string} is {int} on hand and {int} reserved',
  async (
    world: InventoryWorld,
    productId: string,
    onHand: number,
    reserved: number,
  ) => {
    expect(await world.getStockLevel({ productId })).toEqual({
      productId,
      onHand,
      reserved,
    });
  },
);

Then('it is refused with {string}', (world: InventoryWorld, code: string) => {
  expect(world.refusals.pop()?.code).toBe(code);
});

Then('the reservation lists', (world: InventoryWorld, table: DataTable) => {
  expect(
    world.reservation?.lines.map((line) => ({
      product: line.productId,
      quantity: String(line.quantity),
    })),
  ).toEqual(table.hashes());
});

Given(
  'the reservation of order {string} is committed',
  async (world: InventoryWorld, orderId: string) => {
    await world.commitStock({ orderId });
  },
);

Given(
  'the reservation of order {string} is released',
  async (world: InventoryWorld, orderId: string) => {
    await world.releaseStock({ orderId });
  },
);
