import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type {
  AddLine,
  Order,
  OrderStatusChange,
} from '@demo/web-ordering-domain';

const BASE = '/api/orders';
const path = (orderId: string, action = ''): string =>
  `${BASE}/${encodeURIComponent(orderId)}${action}`;

@Service()
export class OrderingApi {
  private readonly http = inject(HttpClient);

  create() {
    return this.http.post<{ orderId: string }>(BASE, null);
  }

  addLine(orderId: string, line: AddLine) {
    return this.http.post<Order>(path(orderId, '/lines'), line);
  }

  place(orderId: string, paymentMethodToken: string) {
    return this.http.post<OrderStatusChange>(path(orderId, '/place'), {
      paymentMethodToken,
    });
  }

  cancel(orderId: string) {
    return this.http.post<OrderStatusChange>(path(orderId, '/cancel'), null);
  }

  /** Reads the order once `orderId` returns an id; call it in an injection context. */
  order(orderId: () => string | undefined) {
    return httpResource<Order>(() => {
      const id = orderId();
      return id === undefined ? undefined : path(id);
    });
  }
}
