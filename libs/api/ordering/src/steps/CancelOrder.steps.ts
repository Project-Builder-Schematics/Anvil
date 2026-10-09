import { When } from 'quickpickle';
import type { OrderingWorld } from './world';

When('the order is cancelled', async (world: OrderingWorld) => {
  await world.attempt(() => world.cancelOrder({ orderId: world.currentId }));
});
