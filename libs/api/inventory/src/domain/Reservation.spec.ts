import { Reservation } from './Reservation';

const lines = [{ productId: 'keyboard', quantity: 4 }];

describe('Reservation', () => {
  it('is held when taken', () => {
    expect(Reservation.hold('o1', lines)).toMatchObject({
      orderId: 'o1',
      lines,
      status: 'Held',
    });
  });

  it('is released once, and stays so', () => {
    const released = Reservation.hold('o1', lines).release();
    expect(released.status).toBe('Released');
    expect(released.release().status).toBe('Released');
  });

  it('is committed once, and stays so', () => {
    const committed = Reservation.hold('o1', lines).commit();
    expect(committed.status).toBe('Committed');
    expect(committed.commit().status).toBe('Committed');
  });

  it('cannot be released after the commit', () => {
    expect(Reservation.hold('o1', lines).commit().release().status).toBe(
      'Committed',
    );
  });

  it('cannot be committed after the release', () => {
    expect(Reservation.hold('o1', lines).release().commit().status).toBe(
      'Released',
    );
  });

  it('is held only until it is settled', () => {
    expect(Reservation.hold('o1', lines).isHeld).toBe(true);
    expect(Reservation.hold('o1', lines).release().isHeld).toBe(false);
    expect(Reservation.hold('o1', lines).commit().isHeld).toBe(false);
  });
});
