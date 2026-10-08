import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  withStatus,
  type AddLine,
  type OrderStatusChange,
} from '@demo/web-ordering-domain';
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
    this._orderId.set('');
    return (await this.run(this.api.create()))?.orderId;
  }

  /** Commands answer whether the server applied them. */
  async addLine(line: AddLine): Promise<boolean> {
    const order = await this.run(this.api.addLine(this.orderId(), line));
    if (order) this.resource.set(order);
    return order !== undefined;
  }

  place(): Promise<boolean> {
    return this.changeStatus(this.api.place(this.orderId()));
  }

  cancel(): Promise<boolean> {
    return this.changeStatus(this.api.cancel(this.orderId()));
  }

  private async changeStatus(
    command: Observable<OrderStatusChange>,
  ): Promise<boolean> {
    const change = await this.run(command);
    if (change) {
      this.resource.update(
        (order) => order && withStatus(order, change.status),
      );
    }
    return change !== undefined;
  }

  /** One command at a time: a command issued while another is in flight is dropped. */
  private async run<T>(command: Observable<T>): Promise<T | undefined> {
    if (this.busy()) return undefined;
    this._busy.set(true);
    this._commandError.set('');
    try {
      return await firstValueFrom(command);
    } catch (error) {
      this._commandError.set(errorCodeOf(error));
      return undefined;
    } finally {
      this._busy.set(false);
    }
  }
}
