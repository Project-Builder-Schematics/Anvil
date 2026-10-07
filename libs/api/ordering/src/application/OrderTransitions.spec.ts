import { Money } from '../domain/Money';
import { Order } from '../domain/Order';
import { OrderId } from '../domain/OrderId';
import { ProductId } from '../domain/ProductId';
import { Quantity } from '../domain/Quantity';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import { makeCancelOrder } from './CancelOrder';
import { makePlaceOrder } from './PlaceOrder';

const id = OrderId.of('a');

const storing = (order: Order) => {
  let stored = order;
  const repository: OrderRepository = {
    nextId: () => id,
    byId: () => Promise.resolve(stored),
    save: (saved) => {
      stored = saved;
      return Promise.resolve();
    },
  };
  return { repository, stored: () => stored };
};

describe('PlaceOrder', () => {
  it('answers the id and the new status, and stores the placed order', async () => {
    const order = Order.create(id).addLine(
      ProductId.of('keyboard'),
      Quantity.of(1),
      Money.of(4500, 'USD'),
    );
    const { repository, stored } = storing(order);

    const result = await makePlaceOrder(repository)({ orderId: 'a' });

    expect(result).toEqual({ orderId: 'a', status: 'Placed' });
    expect(stored().status).toBe('Placed');
  });
});

describe('CancelOrder', () => {
  it('answers the id and the new status, and stores the cancelled order', async () => {
    const { repository, stored } = storing(Order.create(id));

    const result = await makeCancelOrder(repository)({ orderId: 'a' });

    expect(result).toEqual({ orderId: 'a', status: 'Cancelled' });
    expect(stored().status).toBe('Cancelled');
  });
});
