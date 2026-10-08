import { Amount } from '../domain/Amount';
import { Payment } from '../domain/Payment';
import { MemoryPayments } from './MemoryPayments';

const pending = (orderId: string, id = `p-${orderId}`) =>
  Payment.pending(id, orderId, Amount.of(100), 'USD', 'tok_visa');

describe('MemoryPayments (Payments contract)', () => {
  it('answers null for an order that was never saved', async () => {
    expect(await new MemoryPayments().byOrderId('nope')).toBeNull();
  });

  it('answers what save stored under that order', async () => {
    const payments = new MemoryPayments();
    const payment = pending('o1').capture();
    await payments.save(payment);
    expect(await payments.byOrderId('o1')).toBe(payment);
  });

  it('keeps orders apart', async () => {
    const payments = new MemoryPayments();
    await payments.save(pending('o1').capture());
    expect(await payments.byOrderId('o2')).toBeNull();
  });

  it('replaces the payment saved under the same order', async () => {
    const payments = new MemoryPayments();
    await payments.save(pending('o1').fail());
    const retried = pending('o1').capture();
    await payments.save(retried);
    expect(await payments.byOrderId('o1')).toBe(retried);
  });

  describe('save over another id', () => {
    it('does not replace the stored payment with one of another id', async () => {
      const payments = new MemoryPayments();
      const current = pending('o1', 'p2');
      await payments.save(current);
      await payments.save(pending('o1', 'p1').fail());
      expect(await payments.byOrderId('o1')).toBe(current);
    });

    it('replaces the stored payment with the same id moved on', async () => {
      const payments = new MemoryPayments();
      await payments.save(pending('o1', 'p1'));
      const captured = pending('o1', 'p1').capture();
      await payments.save(captured);
      expect(await payments.byOrderId('o1')).toBe(captured);
    });
  });

  describe('startCharge', () => {
    it.each([
      ['captured', pending('o1').capture()],
      ['refunded', pending('o1').capture().refund()],
      ['pending', pending('o1')],
    ])('answers the %s payment and keeps it', async (_status, held) => {
      const payments = new MemoryPayments();
      await payments.save(held);
      expect(await payments.startCharge(pending('o1', 'new'))).toBe(held);
      expect(await payments.byOrderId('o1')).toBe(held);
    });

    it.each([
      ['nothing', undefined],
      ['a failed payment', pending('o1').fail()],
    ])('stores the pending payment over %s', async (_status, before) => {
      const payments = new MemoryPayments();
      if (before) await payments.save(before);
      const started = pending('o1');
      expect(await payments.startCharge(started)).toBe(started);
      expect(await payments.byOrderId('o1')).toBe(started);
    });
  });
});
