import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { OrderStore } from '@demo/web-ordering-data-access';
import {
  canCancel,
  canEdit,
  canPlace,
  messageFor,
  type AddLine,
} from '@demo/web-ordering-domain';
import {
  AddLineForm,
  LineList,
  OrderActions,
  OrderSummary,
} from '@demo/web-ordering-ui';

@Component({
  imports: [RouterLink, OrderSummary, LineList, AddLineForm, OrderActions],
  selector: 'ordering-order-page',
  templateUrl: './order-page.html',
  styleUrl: './order-page.css',
})
export class OrderPage {
  protected readonly store = inject(OrderStore);
  protected readonly canEdit = canEdit;
  protected readonly canPlace = canPlace;
  protected readonly canCancel = canCancel;
  protected readonly notice = signal('');
  protected readonly problem = computed(() => {
    const code = this.store.error();
    return code ? messageFor(code) : '';
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((params) => params.get('orderId') ?? ''),
        takeUntilDestroyed(),
      )
      .subscribe((orderId) => {
        this.store.open(orderId);
        this.notice.set('');
      });
  }

  protected addLine(line: AddLine): Promise<void> {
    return this.announce(this.store.addLine(line), 'Line added.');
  }

  protected place(): Promise<void> {
    return this.announce(this.store.place(), 'Order placed.');
  }

  protected cancel(): Promise<void> {
    return this.announce(this.store.cancel(), 'Order cancelled.');
  }

  private async announce(
    done: Promise<boolean>,
    message: string,
  ): Promise<void> {
    this.notice.set('');
    if (await done) this.notice.set(message);
  }
}
