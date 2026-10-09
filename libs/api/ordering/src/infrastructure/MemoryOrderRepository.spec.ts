import { Order } from '../domain/Order';
import { OrderId } from '../domain/OrderId';
import { MemoryOrderRepository } from './MemoryOrderRepository';

describe('MemoryOrderRepository (OrderRepository contract)', () => {
  it('answers null for an id that was never saved', async () => {
    expect(
      await new MemoryOrderRepository().byId(OrderId.of('nope')),
    ).toBeNull();
  });

  it('answers what save stored under that id', async () => {
    const repository = new MemoryOrderRepository();
    const order = Order.create(OrderId.of('a'));
    await repository.save(order);
    expect(await repository.byId(OrderId.of('a'))).toBe(order);
  });

  it('keeps orders apart by id', async () => {
    const repository = new MemoryOrderRepository();
    await repository.save(Order.create(OrderId.of('a')));
    expect(await repository.byId(OrderId.of('b'))).toBeNull();
  });

  it('replaces the order saved under the same id', async () => {
    const repository = new MemoryOrderRepository();
    const draft = Order.create(OrderId.of('a'));
    await repository.save(draft);
    const cancelled = draft.cancel();
    await repository.save(cancelled);
    expect(await repository.byId(OrderId.of('a'))).toBe(cancelled);
  });

  it('never hands out the same id twice', () => {
    const repository = new MemoryOrderRepository();
    const ids = Array.from({ length: 50 }, () => repository.nextId().value);
    expect(new Set(ids).size).toBe(50);
  });
});
