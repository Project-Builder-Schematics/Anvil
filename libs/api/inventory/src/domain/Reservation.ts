export interface ReservationLine {
  readonly productId: string;
  readonly quantity: number;
}

export type ReservationStatus = 'Held' | 'Released' | 'Committed';

export class Reservation {
  private constructor(
    readonly orderId: string,
    readonly lines: readonly ReservationLine[],
    readonly status: ReservationStatus,
  ) {}

  static hold(orderId: string, lines: readonly ReservationLine[]): Reservation {
    return new Reservation(orderId, lines, 'Held');
  }

  get isHeld(): boolean {
    return this.status === 'Held';
  }

  release(): Reservation {
    return this.settle('Released');
  }

  commit(): Reservation {
    return this.settle('Committed');
  }

  private settle(status: ReservationStatus): Reservation {
    return this.isHeld
      ? new Reservation(this.orderId, this.lines, status)
      : this;
  }
}
