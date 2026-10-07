import { Component, computed, input } from '@angular/core';
import {
  formatMoney,
  lineTotal,
  orderTotal,
  type OrderLine,
} from '@demo/web-ordering-domain';

@Component({
  selector: 'ordering-line-list',
  templateUrl: './line-list.html',
  styleUrl: './line-list.css',
})
export class LineList {
  readonly lines = input.required<OrderLine[]>();

  protected readonly format = formatMoney;
  protected readonly lineTotal = lineTotal;
  protected readonly total = computed(() => orderTotal(this.lines()));
}
