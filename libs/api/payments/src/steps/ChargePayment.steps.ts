import { Given, Then, When } from 'quickpickle';
import { expect } from 'vitest';
import type { PaymentsWorld } from './world';

const charged = (
  world: PaymentsWorld,
  orderId: string,
  amount: number,
  currency: string,
  paymentMethodToken: string,
) =>
  world.attempt(() =>
    world.chargePayment({ orderId, amount, currency, paymentMethodToken }),
  );

When(
  'order {string} is charged {float} {string} with token {string}',
  async (world: PaymentsWorld, ...args: [string, number, string, string]) => {
    await charged(world, ...args);
  },
);

When(
  'order {string} is charged {int} {string} with token {string} twice at once',
  async (world: PaymentsWorld, ...args: [string, number, string, string]) => {
    await Promise.all([charged(world, ...args), charged(world, ...args)]);
  },
);

Given(
  'order {string} has been charged {int} {string} with token {string}',
  async (world: PaymentsWorld, ...args: [string, number, string, string]) => {
    await charged(world, ...args);
  },
);

Given('the gateway gives no answer', (world: PaymentsWorld) => {
  world.charge.mockRejectedValueOnce(world.timeout);
});

Given(
  'the gateway gave no answer to the charge of order {string} at {int} {string} with token {string}',
  async (world: PaymentsWorld, ...args: [string, number, string, string]) => {
    world.charge.mockRejectedValueOnce(world.timeout);
    await charged(world, ...args);
    expect(world.refusals.pop()).toBe(world.timeout);
  },
);

Given(
  'the gateway took the money of order {string} at {int} {string} with token {string} but its answer was lost',
  async (world: PaymentsWorld, ...args: [string, number, string, string]) => {
    world.charge.mockImplementationOnce(async (request) => {
      await world.gateway.charge(request);
      throw world.timeout;
    });
    await charged(world, ...args);
    expect(world.refusals.pop()).toBe(world.timeout);
  },
);

Given(
  'order {string} has been declined with token {string}',
  async (world: PaymentsWorld, orderId: string, token: string) => {
    await charged(world, orderId, 4500, 'USD', token);
    expect(world.refusals.pop()).toMatchObject({ code: 'PAYMENT_DECLINED' });
  },
);

Then(
  'the payment of order {string} is {string} for {int} {string}',
  async (
    world: PaymentsWorld,
    orderId: string,
    status: string,
    amount: number,
    currency: string,
  ) => {
    expect(await world.payments.byOrderId(orderId)).toMatchObject({
      status,
      amount: { value: amount },
      currency,
    });
  },
);

Then(
  'order {string} has no payment',
  async (world: PaymentsWorld, id: string) => {
    expect(await world.payments.byOrderId(id)).toBeNull();
  },
);

Then('it is refused with {string}', (world: PaymentsWorld, code: string) => {
  expect(world.refusals.pop()).toMatchObject({ code });
});

Then(
  'the charge fails with {string}',
  (world: PaymentsWorld, message: string) => {
    expect(world.refusals.pop()?.message).toBe(message);
  },
);

Then(
  'the gateway has been charged {int} in total',
  (world: PaymentsWorld, times: number) => {
    expect(world.gateway.capturedKeys.size).toBe(times);
  },
);

Then(
  'the gateway was asked to charge {int} {string} with token {string}',
  (world: PaymentsWorld, amount: number, currency: string, token: string) => {
    expect(world.charge).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        amount,
        currency,
        paymentMethodToken: token,
      }),
    );
  },
);

Then(
  'the gateway was given the idempotency key {string}',
  (world: PaymentsWorld, idempotencyKey: string) => {
    expect(world.charge).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey }),
    );
  },
);
