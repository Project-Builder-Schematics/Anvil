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

Given(
  'order {string} has been charged {int} {string} with token {string}',
  async (world: PaymentsWorld, ...args: [string, number, string, string]) => {
    await charged(world, ...args);
  },
);

Given(
  'order {string} has been declined with token {string}',
  async (world: PaymentsWorld, orderId: string, token: string) => {
    await charged(world, orderId, 4500, 'USD', token);
    expect(world.refusals.pop()?.code).toBe('PAYMENT_DECLINED');
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
  expect(world.refusals.pop()?.code).toBe(code);
});

Then(
  'the gateway has been charged {int} in total',
  (world: PaymentsWorld, times: number) => {
    expect(world.charge).toHaveBeenCalledTimes(times);
  },
);

Then(
  'the gateway was asked to charge {int} {string} with token {string}',
  (world: PaymentsWorld, amount: number, currency: string, token: string) => {
    expect(world.charge).toHaveBeenCalledExactlyOnceWith({
      amount,
      currency,
      paymentMethodToken: token,
    });
  },
);
