import { Component, input, output } from '@angular/core';
import { Button, DsVariant } from '@demo/web-shared-design-system';

@Component({
  imports: [Button, DsVariant],
  selector: 'ordering-order-actions',
  templateUrl: './order-actions.html',
  styleUrl: './order-actions.css',
})
export class OrderActions {
  readonly canPlace = input.required<boolean>();
  readonly canCancel = input.required<boolean>();
  readonly busy = input.required<boolean>();
  readonly placeOrder = output();
  readonly cancelOrder = output();
}
