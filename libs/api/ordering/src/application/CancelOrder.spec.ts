import { Order } from '../domain/Order';
import { OrderId } from '../domain/OrderId';
import type { DomainEvents } from '../domain/driven-ports/DomainEvents';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import { makeCancelOrder } from './CancelOrder';

const id = OrderId.of('a');

describe('CancelOrder', () => {
  it('answers the id and the new status, stores the cancelled order and then publishes OrderCancelled', async () => {
    const calls: string[] = [];
    let stored = Order.create(id);
    const repository: OrderRepository = {
      nextId: () => id,
      byId: () => Promise.resolve(stored),
      save: (saved) => {
        stored = saved;
        calls.push(`save ${saved.status}`);
        return Promise.resolve();
      },
    };
    const events: DomainEvents = {
      publish: (event) => {
        calls.push(`publish ${event.type} ${event.orderId}`);
        return Promise.resolve();
      },
    };

    const result = await makeCancelOrder(repository, events)({ orderId: 'a' });

    expect(result).toEqual({ orderId: 'a', status: 'Cancelled' });
    expect(calls).toEqual(['save Cancelled', 'publish OrderCancelled a']);
  });
});
