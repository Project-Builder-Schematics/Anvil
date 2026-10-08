import { Given, When } from 'quickpickle';
import type { PaymentsWorld } from './world';

When(
  'order {string} is refunded',
  async (world: PaymentsWorld, orderId: string) => {
    await world.attempt(() => world.refundPayment({ orderId }));
  },
);

Given(
  'order {string} has been refunded',
  async (world: PaymentsWorld, orderId: string) => {
    await world.refundPayment({ orderId });
  },
);
