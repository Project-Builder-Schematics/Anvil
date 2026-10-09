import { Given, When } from 'quickpickle';
import { expect } from 'vitest';
import type { OrderingWorld } from './world';

When(
  'the order is placed with the payment method {string}',
  async (world: OrderingWorld, token: string) => {
    await world.attempt(() =>
      world.placeOrder({ orderId: world.currentId, paymentMethodToken: token }),
    );
  },
);

Given(
  'the order has been paid with the payment method {string}',
  async (world: OrderingWorld, token: string) => {
    const { status } = await world.placeOrder({
      orderId: world.currentId,
      paymentMethodToken: token,
    });
    expect(status).toBe('Paid');
  },
);

Given(
  'the order has been placed while payments gives no answer',
  async (world: OrderingWorld) => {
    world.charges.giveNoAnswerOnce();
    await world.attempt(() =>
      world.placeOrder({
        orderId: world.currentId,
        paymentMethodToken: 'tok_visa',
      }),
    );
    expect(world.noAnswers).toBe(1);
    world.noAnswers = 0;
  },
);
