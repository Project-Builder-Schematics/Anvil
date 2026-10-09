import { Component, computed, input } from '@angular/core';
import { availableOf, type StockLevel } from '@anvil/web-inventory-domain';

@Component({
  selector: 'inventory-stock-summary',
  templateUrl: './stock-summary.html',
  styleUrl: './stock-summary.css',
})
export class StockSummary {
  readonly level = input.required<StockLevel>();
  protected readonly available = computed(() => availableOf(this.level()));
}
