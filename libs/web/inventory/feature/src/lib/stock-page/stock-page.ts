import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { StockStore } from '@anvil/web-inventory-data-access';
import { messageFor } from '@anvil/web-inventory-domain';
import { StockLevelForm, StockSummary } from '@anvil/web-inventory-ui';

@Component({
  imports: [StockSummary, StockLevelForm],
  selector: 'inventory-stock-page',
  templateUrl: './stock-page.html',
  styleUrl: './stock-page.css',
})
export class StockPage {
  protected readonly store = inject(StockStore);
  protected readonly notice = signal('');
  protected readonly problem = computed(() => {
    const code = this.store.error();
    return code ? messageFor(code) : '';
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((params) => params.get('productId') ?? ''),
        takeUntilDestroyed(),
      )
      .subscribe((productId) => {
        this.store.open(productId);
        this.notice.set('');
      });
  }

  protected async setLevel(onHand: number): Promise<void> {
    this.notice.set('');
    if (await this.store.setLevel(onHand)) this.notice.set('Stock level set.');
  }
}
