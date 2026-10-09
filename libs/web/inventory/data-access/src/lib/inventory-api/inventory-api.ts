import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { StockLevel } from '@anvil/web-inventory-domain';

const path = (productId: string): string =>
  `/api/stock/${encodeURIComponent(productId)}`;

@Service()
export class InventoryApi {
  private readonly http = inject(HttpClient);

  setLevel(productId: string, onHand: number) {
    return this.http.put<StockLevel>(path(productId), { onHand });
  }

  /** Reads the stock level once `productId` returns an id; call it in an injection context. */
  stock(productId: () => string | undefined) {
    return httpResource<StockLevel>(() => {
      const id = productId();
      return id === undefined ? undefined : path(id);
    });
  }
}
