import { When } from 'quickpickle';
import type { OrderingWorld } from './world';

When('the order is placed', async (world: OrderingWorld) => {
  await world.attempt(() => world.placeOrder({ orderId: world.currentId }));
});
