import { Given, Then, When } from 'quickpickle';
import { expect } from 'vitest';
import type { PaymentsWorld } from './world';

type ChargeArgs = [
  orderId: string,
  amount: number,
  currency: string,
  token: string,
];

const charged = (world: PaymentsWorld, ...args: ChargeArgs) => {
  const [orderId, amount, currency, paymentMethodToken] = args;
  return world.attempt(() =>
    world.chargePayment({ orderId, amount, currency, paymentMethodToken }),
  );
};

/** The charge the scenario is about: its answer is kept for "the answer is". */
const asked = async (world: PaymentsWorld, ...args: ChargeArgs) => {
  const answer = await charged(world, ...args);
  if (answer) world.answers.push(answer);
};

When(
  'order {string} is charged {float} {string} with token {string}',
  async (world: PaymentsWorld, ...args: ChargeArgs) => {
    await asked(world, ...args);
  },
);

When(
  'order {string} is charged {int} {string} with token {string} twice at once',
  async (world: PaymentsWorld, ...args: ChargeArgs) => {
    await Promise.all([asked(world, ...args), asked(world, ...args)]);
  },
);

Given(
  'order {string} has been charged {int} {string} with token {string}',
  async (world: PaymentsWorld, ...args: ChargeArgs) => {
    await charged(world, ...args);
  },
);

Given('the gateway gives no answer', (world: PaymentsWorld) => {
  world.charge.mockRejectedValueOnce(world.timeout);
});

Given(
  'the gateway gave no answer to the charge of order {string} at {int} {string} with token {string}',
  async (world: PaymentsWorld, ...args: ChargeArgs) => {
    world.charge.mockRejectedValueOnce(world.timeout);
    await charged(world, ...args);
    expect(world.refusals.pop()).toBe(world.timeout);
  },
);

Given(
  'the gateway took the money of order {string} at {int} {string} with token {string} but its answer was lost',
  async (world: PaymentsWorld, ...args: ChargeArgs) => {
    world.charge.mockImplementationOnce(async (request) => {
      await world.gateway.charge(request);
      throw world.timeout;
    });
    await charged(world, ...args);
    expect(world.refusals.pop()).toBe(world.timeout);
  },
);

Given(
  'order {string} has been declined at {int} {string} with token {string}',
  async (world: PaymentsWorld, ...args: ChargeArgs) => {
    await charged(world, ...args);
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
  'the answer is {string} for {int} {string} on order {string}',
  (
    world: PaymentsWorld,
    status: string,
    amount: number,
    currency: string,
    orderId: string,
  ) => {
    expect(world.answers).not.toHaveLength(0);
    for (const answer of world.answers)
      expect(answer).toEqual({ orderId, status, amount, currency });
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
    expect(world.gateway.captured).toBe(times);
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
  'the gateway was given the id of the payment of order {string} as its idempotency key',
  async (world: PaymentsWorld, orderId: string) => {
    const payment = await world.payments.byOrderId(orderId);
    expect(payment?.id).not.toBe(orderId);
    expect(world.charge).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ idempotencyKey: payment?.id }),
    );
  },
);

Then(
  'the gateway was last asked to charge {int} {string} with token {string}',
  (world: PaymentsWorld, amount: number, currency: string, token: string) => {
    expect(world.charge).toHaveBeenLastCalledWith(
      expect.objectContaining({ amount, currency, paymentMethodToken: token }),
    );
  },
);

Then(
  'the number of idempotency keys the gateway was given is {int}',
  (world: PaymentsWorld, count: number) => {
    const keys = world.charge.mock.calls.map(([r]) => r.idempotencyKey);
    expect(new Set(keys).size).toBe(count);
  },
);
