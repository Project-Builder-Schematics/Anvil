import type { Reservation } from '../Reservation';

export interface Reservations {
  byOrderId(orderId: string): Promise<Reservation | null>;
  save(reservation: Reservation): Promise<void>;
}

export const RESERVATIONS = Symbol('Reservations');
