import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Order } from '@demo/web-ordering-domain';
import { OrderingApi } from './ordering-api';

const order: Order = {
  orderId: 'o1',
  status: 'Draft',
  lines: [
    {
      productId: 'keyboard',
      quantity: 2,
      unitPrice: { amount: 4500, currency: 'USD' },
    },
  ],
};

describe('OrderingApi', () => {
  let api: OrderingApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(OrderingApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('creates an order with a body-less POST', () => {
    let result: unknown;
    api.create().subscribe((value) => (result = value));

    const request = http.expectOne('/api/orders');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({ orderId: 'o1' });

    expect(result).toEqual({ orderId: 'o1' });
  });

  it('adds a line and answers the whole order', () => {
    let result: unknown;
    api
      .addLine('o1', { productId: 'keyboard', quantity: 2 })
      .subscribe((value) => (result = value));

    const request = http.expectOne('/api/orders/o1/lines');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      productId: 'keyboard',
      quantity: 2,
    });
    request.flush(order);

    expect(result).toEqual(order);
  });

  it.each(['place', 'cancel'] as const)(
    'posts %s with no body and answers the new status',
    (action) => {
      let result: unknown;
      api[action]('o1').subscribe((value) => (result = value));

      const request = http.expectOne(`/api/orders/o1/${action}`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toBeNull();
      request.flush({ orderId: 'o1', status: 'Placed' });

      expect(result).toEqual({ orderId: 'o1', status: 'Placed' });
    },
  );

  it('encodes the order id in the path', () => {
    api.place('a/b c').subscribe();

    http.expectOne('/api/orders/a%2Fb%20c/place').flush({});
  });

  describe('order', () => {
    it('reads an order with a GET once it has an id', async () => {
      const id = signal<string | undefined>(undefined);
      const resource = TestBed.runInInjectionContext(() => api.order(id));
      TestBed.tick();

      http.expectNone('/api/orders/o1');
      expect(resource.value()).toBeUndefined();

      id.set('o1');
      TestBed.tick();
      http.expectOne('/api/orders/o1').flush(order);
      await TestBed.inject(ApplicationRef).whenStable();

      expect(resource.value()).toEqual(order);
    });
  });
});
