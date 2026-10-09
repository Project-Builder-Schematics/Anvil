import { Given, Then, type DataTable } from 'quickpickle';
import { expect } from 'vitest';
import type { OrderingWorld } from './world';

Given(
  'the stock of {string} is {int}',
  (world: OrderingWorld, product: string, onHand: number) => {
    world.stock.setOnHand(product, onHand);
  },
);

Given('payments gives no answer to the next charge', (world: OrderingWorld) => {
  world.charges.giveNoAnswerOnce();
});

Given(
  'inventory gives no answer to the next commit',
  (world: OrderingWorld) => {
    world.stock.giveNoAnswerOnce();
  },
);

Then('{word} gave no answer', (world: OrderingWorld) => {
  expect(world.noAnswers).toBe(1);
  world.noAnswers = 0;
});

Then(
  'the stock of {string} is {int} on hand and {int} reserved',
  (world: OrderingWorld, product: string, onHand: number, reserved: number) => {
    expect(world.stock.level(product)).toEqual({ onHand, reserved });
  },
);

Then(
  'payments was asked to charge {int} {string} with the payment method {string}',
  (world: OrderingWorld, amount: number, currency: string, token: string) => {
    expect(
      world.charges.requests.map(({ total, token }) => ({
        amount: total.amount,
        currency: total.currency,
        token,
      })),
    ).toEqual([{ amount, currency, token }]);
  },
);

Then(
  'the number of charges requested is {int}',
  (world: OrderingWorld, count: number) => {
    expect(world.charges.requests).toHaveLength(count);
  },
);

Then(
  'the number of charges payments has captured is {int}',
  (world: OrderingWorld, count: number) => {
    expect(world.charges.capturedCount).toBe(count);
  },
);

Then(
  'inventory was asked to reserve',
  (world: OrderingWorld, table: DataTable) => {
    expect(
      world.stock.requests.map((lines) =>
        lines.map((line) => ({
          product: line.productId.value,
          quantity: String(line.quantity.value),
        })),
      ),
    ).toEqual([table.hashes()]);
  },
);

Then('no event is published', (world: OrderingWorld) => {
  expect(world.events.published).toEqual([]);
});

Then('the events published are', (world: OrderingWorld, table: DataTable) => {
  expect(world.events.published).toEqual(
    table
      .hashes()
      .map(({ event }) => ({ type: event, orderId: world.currentId })),
  );
});
