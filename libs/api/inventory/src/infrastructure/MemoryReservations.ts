import { Injectable } from '@nestjs/common';
import type { Reservation } from '../domain/Reservation';
import type { Reservations } from '../domain/driven-ports/Reservations';

@Injectable()
export class MemoryReservations implements Reservations {
  private readonly reservations = new Map<string, Reservation>();

  byOrderId(orderId: string): Promise<Reservation | null> {
    return Promise.resolve(this.reservations.get(orderId) ?? null);
  }

  save(reservation: Reservation): Promise<void> {
    this.reservations.set(reservation.orderId, reservation);
    return Promise.resolve();
  }
}
