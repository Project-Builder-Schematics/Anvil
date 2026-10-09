import { Then, When } from 'quickpickle';
import { expect } from 'vitest';
import type { InventoryWorld } from './world';

When(
  'the stock of {string} is requested',
  async (world: InventoryWorld, productId: string) => {
    world.shown = await world.attempt(() => world.getStockLevel({ productId }));
  },
);

Then(
  'the stock shown is {int} on hand and {int} reserved',
  (world: InventoryWorld, onHand: number, reserved: number) => {
    expect(world.shown).toMatchObject({ onHand, reserved });
  },
);
