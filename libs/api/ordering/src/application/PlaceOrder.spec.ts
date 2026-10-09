import { Money } from '../domain/Money';
import { Order } from '../domain/Order';
import { OrderId } from '../domain/OrderId';
import { ProductId } from '../domain/ProductId';
import { Quantity } from '../domain/Quantity';
import type { Charges } from '../domain/driven-ports/Charges';
import type { DomainEvents } from '../domain/driven-ports/DomainEvents';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';
import type { StockReservation } from '../domain/driven-ports/StockReservation';
import { makePlaceOrder } from './PlaceOrder';

const id = OrderId.of('a');
const command = { orderId: 'a', paymentMethodToken: 'tok' };

const setup = (
  outcomes: {
    reserve?: 'Reserved' | 'OutOfStock';
    charge?: 'Captured' | 'Declined' | Error;
    commit?: Error;
    savePaid?: Error;
    publish?: Error;
  } = {},
) => {
  const calls: string[] = [];
  let stored = Order.create(id).addLine(
    ProductId.of('keyboard'),
    Quantity.of(2),
    Money.of(4500, 'USD'),
  );
  const repository: OrderRepository = {
    nextId: () => id,
    byId: () => Promise.resolve(stored),
    save: (saved) => {
      calls.push(`save ${saved.status}`);
      if (saved.status === 'Paid' && outcomes.savePaid)
        return Promise.reject(outcomes.savePaid);
      stored = saved;
      return Promise.resolve();
    },
  };
  const stock: StockReservation = {
    reserve: () => {
      calls.push('reserve');
      return Promise.resolve(outcomes.reserve ?? 'Reserved');
    },
    release: () => {
      calls.push('release');
      return Promise.resolve();
    },
    commit: () => {
      calls.push('commit');
      return outcomes.commit
        ? Promise.reject(outcomes.commit)
        : Promise.resolve();
    },
  };
  const charges: Charges = {
    charge: (_id, total, token) => {
      calls.push(`charge ${String(total.amount)} ${token}`);
      const outcome = outcomes.charge ?? 'Captured';
      return outcome instanceof Error
        ? Promise.reject(outcome)
        : Promise.resolve(outcome);
    },
  };
  const events: DomainEvents = {
    publish: (event) => {
      calls.push(`publish ${event.type} ${event.orderId}`);
      return outcomes.publish
        ? Promise.reject(outcomes.publish)
        : Promise.resolve();
    },
  };
  return {
    calls,
    place: makePlaceOrder(repository, stock, charges, events),
    stored: () => stored,
  };
};

describe('PlaceOrder', () => {
  it('reserves, charges, commits, saves the paid order and then publishes', async () => {
    const { place, calls } = setup();

    expect(await place(command)).toEqual({ orderId: 'a', status: 'Paid' });
    expect(calls).toEqual([
      'save Placed',
      'reserve',
      'charge 9000 tok',
      'commit',
      'save Paid',
      'publish OrderPaid a',
    ]);
  });

  it('goes back to draft without charging when the stock is short', async () => {
    const { place, calls, stored } = setup({ reserve: 'OutOfStock' });

    await expect(place(command)).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    });
    expect(calls).toEqual(['save Placed', 'reserve', 'save Draft']);
    expect(stored().status).toBe('Draft');
  });

  it('releases the stock and goes back to draft when the payment is declined', async () => {
    const { place, calls } = setup({ charge: 'Declined' });

    await expect(place(command)).rejects.toMatchObject({
      code: 'PAYMENT_DECLINED',
    });
    expect(calls).toEqual([
      'save Placed',
      'reserve',
      'charge 9000 tok',
      'release',
      'save Draft',
    ]);
  });

  it('compensates nothing when the charge gives no answer', async () => {
    const down = new Error('timeout');
    const { place, calls, stored } = setup({ charge: down });

    await expect(place(command)).rejects.toBe(down);
    expect(calls).toEqual(['save Placed', 'reserve', 'charge 9000 tok']);
    expect(stored().status).toBe('Placed');
  });

  it('publishes the id of the order it paid, not the one in the command', async () => {
    const { place, calls } = setup();

    await place({ ...command, orderId: ' a' });

    expect(calls).toContain('publish OrderPaid a');
  });

  describe('once the charge is captured', () => {
    const down = new Error('down');

    it('leaves the order placed, with its stock reserved, when the commit fails', async () => {
      const { place, calls, stored } = setup({ commit: down });

      await expect(place(command)).rejects.toBe(down);
      expect(calls).toEqual([
        'save Placed',
        'reserve',
        'charge 9000 tok',
        'commit',
      ]);
      expect(stored().status).toBe('Placed');
    });

    it('leaves the order placed, without releasing the stock, when saving it paid fails', async () => {
      const { place, calls, stored } = setup({ savePaid: down });

      await expect(place(command)).rejects.toBe(down);
      expect(calls).toEqual([
        'save Placed',
        'reserve',
        'charge 9000 tok',
        'commit',
        'save Paid',
      ]);
      expect(stored().status).toBe('Placed');
    });

    it('keeps the order paid and loses the event when the publish fails', async () => {
      const { place, calls, stored } = setup({ publish: down });

      await expect(place(command)).rejects.toBe(down);
      expect(calls.at(-1)).toBe('publish OrderPaid a');
      expect(calls).not.toContain('release');
      expect(stored().status).toBe('Paid');
    });
  });

  it('runs two placements of one order one after the other', async () => {
    const { place, calls } = setup();

    const [first, second] = await Promise.allSettled([
      place(command),
      place(command),
    ]);

    expect(first).toEqual({
      status: 'fulfilled',
      value: { orderId: 'a', status: 'Paid' },
    });
    expect(second).toMatchObject({
      status: 'rejected',
      reason: { code: 'ORDER_NOT_EDITABLE' },
    });
    expect(calls.filter((call) => call.startsWith('publish'))).toEqual([
      'publish OrderPaid a',
    ]);
  });
});
