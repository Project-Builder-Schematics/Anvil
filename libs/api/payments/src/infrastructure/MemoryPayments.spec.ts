import { Amount } from '../domain/Amount';
import { Payment } from '../domain/Payment';
import { MemoryPayments } from './MemoryPayments';

const pending = (orderId: string) =>
  Payment.pending(orderId, Amount.of(100), 'USD');

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
});
