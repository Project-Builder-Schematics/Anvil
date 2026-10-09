import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  withStatus,
  type AddLine,
  type OrderStatusChange,
} from '@anvil/web-ordering-domain';
import { errorCodeOf } from '../error-code';
import { OrderingApi } from '../ordering-api/ordering-api';

@Service()
export class OrderStore {
  private readonly _orderId = signal<string>('');
  readonly orderId = this._orderId.asReadonly();
  private readonly _busy = signal<boolean>(false);
  readonly busy = this._busy.asReadonly();
  private readonly _commandError = signal<string>('');
  readonly commandError = this._commandError.asReadonly();

  private readonly api = inject(OrderingApi);
  private readonly resource = this.api.order(() => this.orderId() || undefined);

  readonly loading = this.resource.isLoading;
  readonly order = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );
  /** The code of the last refused command, or of the failed read. */
  readonly error = computed(
    () =>
      this.commandError() ||
      (this.resource.error() ? errorCodeOf(this.resource.error()) : ''),
  );

  open(orderId: string): void {
    this._commandError.set('');
    this._orderId.set(orderId);
  }

  async create(): Promise<string | undefined> {
    const created = await this.run(() => {
      this._orderId.set('');
      return this.api.create();
    });
    return created?.orderId;
  }

  /** Commands answer whether the server applied them to the order still open. */
  addLine(line: AddLine): Promise<boolean> {
    return this.command(
      (orderId) => this.api.addLine(orderId, line),
      (order) => {
        this.resource.set(order);
      },
    );
  }

  /** A server error leaves the payment outcome unknown (rule 17): read the order again, which stays `Placed`. */
  async place(paymentMethodToken: string): Promise<boolean> {
    const placed = await this.changeStatus((orderId) =>
      this.api.place(orderId, paymentMethodToken),
    );
    if (!placed && this.commandError() === 'SERVER_ERROR') {
      this._commandError.set('PAYMENT_OUTCOME_UNKNOWN');
      this.resource.reload();
    }
    return placed;
  }

  cancel(): Promise<boolean> {
    return this.changeStatus((orderId) => this.api.cancel(orderId));
  }

  private changeStatus(
    request: (orderId: string) => Observable<OrderStatusChange>,
  ): Promise<boolean> {
    return this.command(request, (change) => {
      this.resource.update(
        (order) => order && withStatus(order, change.status),
      );
    });
  }

  /** The response is dropped when another order was opened while it was in flight. */
  private async command<T>(
    request: (orderId: string) => Observable<T>,
    apply: (result: T) => void,
  ): Promise<boolean> {
    const orderId = this.orderId();
    if (!orderId) {
      this._commandError.set('ORDER_NOT_FOUND');
      return false;
    }
    const result = await this.run(() => request(orderId));
    if (result === undefined || this.orderId() !== orderId) return false;
    apply(result);
    return true;
  }

  /** One command at a time: a command issued while another is in flight is refused. */
  private async run<T>(request: () => Observable<T>): Promise<T | undefined> {
    if (this.busy()) {
      this._commandError.set('COMMAND_IN_PROGRESS');
      return undefined;
    }
    this._busy.set(true);
    this._commandError.set('');
    try {
      const result = await firstValueFrom(request());
      this._commandError.set('');
      return result;
    } catch (error) {
      this._commandError.set(errorCodeOf(error));
      return undefined;
    } finally {
      this._busy.set(false);
    }
  }
}
