import { Component, input } from '@angular/core';
import type { OrderStatus } from '@anvil/web-ordering-domain';

@Component({
  selector: 'ordering-order-summary',
  templateUrl: './order-summary.html',
  styleUrl: './order-summary.css',
})
export class OrderSummary {
  readonly orderId = input.required<string>();
  readonly status = input.required<OrderStatus>();
}
