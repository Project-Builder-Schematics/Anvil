import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorCodeOf } from '../error-code';
import { InventoryApi } from '../inventory-api/inventory-api';

@Service()
export class StockStore {
  private readonly _productId = signal<string>('');
  readonly productId = this._productId.asReadonly();
  private readonly _busy = signal<boolean>(false);
  readonly busy = this._busy.asReadonly();
  private readonly _commandError = signal<string>('');
  readonly commandError = this._commandError.asReadonly();

  private readonly api = inject(InventoryApi);
  private readonly resource = this.api.stock(
    () => this.productId() || undefined,
  );

  readonly loading = this.resource.isLoading;
  readonly level = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );
  /** The code of the last refused command, or of the failed read. */
  readonly error = computed(
    () =>
      this.commandError() ||
      (this.resource.error() ? errorCodeOf(this.resource.error()) : ''),
  );

  open(productId: string): void {
    this._commandError.set('');
    this._productId.set(productId);
  }

  /**
   * Answers whether the server applied the level to the product still open; one command
   * at a time, and a response that lands after another product was opened is dropped.
   */
  async setLevel(onHand: number): Promise<boolean> {
    if (this.busy()) {
      this._commandError.set('COMMAND_IN_PROGRESS');
      return false;
    }
    const productId = this.productId();
    this._busy.set(true);
    this._commandError.set('');
    try {
      const level = await firstValueFrom(this.api.setLevel(productId, onHand));
      this._commandError.set('');
      if (this.productId() !== productId) return false;
      this.resource.set(level);
      return true;
    } catch (error) {
      this._commandError.set(errorCodeOf(error));
      return false;
    } finally {
      this._busy.set(false);
    }
  }
}
