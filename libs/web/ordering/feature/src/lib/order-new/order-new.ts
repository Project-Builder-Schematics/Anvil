import { Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OrderStore } from '@anvil/web-ordering-data-access';
import { messageFor } from '@anvil/web-ordering-domain';
import { Button } from '@anvil/web-shared-design-system';

@Component({
  imports: [Button],
  selector: 'ordering-order-new',
  templateUrl: './order-new.html',
  styleUrl: './order-new.css',
})
export class OrderNew implements OnInit {
  private readonly store = inject(OrderStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly problem = computed(() => {
    const code = this.store.error();
    return code ? messageFor(code) : '';
  });

  ngOnInit(): void {
    void this.start();
  }

  protected async start(): Promise<void> {
    const orderId = await this.store.create();
    if (orderId && !this.destroyRef.destroyed) {
      await this.router.navigate(['/orders', orderId], { replaceUrl: true });
    }
  }
}
