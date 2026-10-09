import { MemoryDomainEvents } from './MemoryDomainEvents';

describe('MemoryDomainEvents', () => {
  it('keeps the published events in order', async () => {
    const events = new MemoryDomainEvents();

    await events.publish({ type: 'OrderPaid', orderId: 'a' });
    await events.publish({ type: 'OrderCancelled', orderId: 'b' });

    expect(events.published).toEqual([
      { type: 'OrderPaid', orderId: 'a' },
      { type: 'OrderCancelled', orderId: 'b' },
    ]);
  });
});
