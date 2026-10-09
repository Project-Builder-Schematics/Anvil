import type { Money } from '../domain/Money';
import type { OrderId } from '../domain/OrderId';
import type { OrderLine } from '../domain/OrderLine';
import type { Charges } from '../domain/driven-ports/Charges';
import type { StockReservation } from '../domain/driven-ports/StockReservation';

/** A provider that took the request but whose answer never arrived. */
export class NoAnswer extends Error {}

interface Level {
  onHand: number;
  reserved: number;
}

type Status = 'Held' | 'Released' | 'Committed';

/** Keeps inventory's contract: all-or-nothing, one reservation per order, release and commit act on a held one. */
export class FakeStockReservation implements StockReservation {
  private readonly levels = new Map<string, Level>();
  private readonly reservations = new Map<
    string,
    { status: Status; lines: readonly OrderLine[] }
  >();
  readonly requests: (readonly OrderLine[])[] = [];
  private silent = false;

  /** The next commit gives no answer and changes nothing. */
  giveNoAnswerOnce(): void {
    this.silent = true;
  }

  setOnHand(product: string, onHand: number): void {
    this.levels.set(product, {
      onHand,
      reserved: this.levels.get(product)?.reserved ?? 0,
    });
  }

  level(product: string): Level | undefined {
    return this.levels.get(product);
  }

  reserve(
    orderId: OrderId,
    lines: readonly OrderLine[],
  ): Promise<'Reserved' | 'OutOfStock'> {
    this.requests.push(lines);
    const existing = this.reservations.get(orderId.value);
    if (existing && existing.status !== 'Released')
      return Promise.resolve('Reserved');
    const covered = lines.every((line) => {
      const level = this.levels.get(line.productId.value);
      return level && level.onHand - level.reserved >= line.quantity.value;
    });
    if (!covered) return Promise.resolve('OutOfStock');
    for (const line of lines)
      this.levelOf(line.productId.value).reserved += line.quantity.value;
    this.reservations.set(orderId.value, { status: 'Held', lines });
    return Promise.resolve('Reserved');
  }

  release(orderId: OrderId): Promise<void> {
    this.settle(orderId, 'Released', 0);
    return Promise.resolve();
  }

  commit(orderId: OrderId): Promise<void> {
    if (this.silent) {
      this.silent = false;
      return Promise.reject(new NoAnswer());
    }
    this.settle(orderId, 'Committed', -1);
    return Promise.resolve();
  }

  private levelOf(product: string): Level {
    const level = this.levels.get(product);
    if (!level) throw new Error(`no stock record for ${product}`);
    return level;
  }

  private settle(orderId: OrderId, status: Status, onHandSign: 0 | -1): void {
    const reservation = this.reservations.get(orderId.value);
    if (reservation?.status !== 'Held') return;
    for (const line of reservation.lines) {
      const level = this.levelOf(line.productId.value);
      level.reserved -= line.quantity.value;
      level.onHand += onHandSign * line.quantity.value;
    }
    reservation.status = status;
  }
}

/** Keeps payments' contract: `tok_decline` and an amount it refuses (rule 21) are declined and not remembered, a captured order is charged once. */
export class FakeCharges implements Charges {
  readonly requests: { total: Money; token: string }[] = [];
  private readonly captured = new Set<string>();
  private silent = false;

  get capturedCount(): number {
    return this.captured.size;
  }

  /** The next new charge takes the money and then gives no answer. */
  giveNoAnswerOnce(): void {
    this.silent = true;
  }

  charge(
    orderId: OrderId,
    total: Money,
    token: string,
  ): Promise<'Captured' | 'Declined'> {
    this.requests.push({ total, token });
    if (total.amount <= 0) return Promise.resolve('Declined');
    if (this.captured.has(orderId.value)) return Promise.resolve('Captured');
    if (token === 'tok_decline') return Promise.resolve('Declined');
    this.captured.add(orderId.value);
    if (!this.silent) return Promise.resolve('Captured');
    this.silent = false;
    return Promise.reject(new NoAnswer());
  }
}
