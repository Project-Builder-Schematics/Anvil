import { Reservation } from '../domain/Reservation';
import { MemoryReservations } from './MemoryReservations';

const lines = [{ productId: 'keyboard', quantity: 1 }];

describe('MemoryReservations (Reservations contract)', () => {
  it('answers null for an order that was never saved', async () => {
    expect(await new MemoryReservations().byOrderId('nope')).toBeNull();
  });

  it('answers what save stored under that order', async () => {
    const reservations = new MemoryReservations();
    const reservation = Reservation.hold('o1', lines);
    await reservations.save(reservation);
    expect(await reservations.byOrderId('o1')).toBe(reservation);
  });

  it('keeps orders apart', async () => {
    const reservations = new MemoryReservations();
    await reservations.save(Reservation.hold('o1', lines));
    expect(await reservations.byOrderId('o2')).toBeNull();
  });

  it('replaces the reservation saved under the same order', async () => {
    const reservations = new MemoryReservations();
    const held = Reservation.hold('o1', lines);
    await reservations.save(held);
    const released = held.release();
    await reservations.save(released);
    expect(await reservations.byOrderId('o1')).toBe(released);
  });
});
