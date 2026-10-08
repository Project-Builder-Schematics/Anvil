import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Order } from '@demo/web-ordering-domain';
import { OrderStore } from './order-store';

const keyboard = {
  productId: 'keyboard',
  quantity: 2,
  unitPrice: { amount: 4500, currency: 'USD' },
};
const draft: Order = { orderId: 'o1', status: 'Draft', lines: [] };
const refusal = (status: number, code: string) => ({
  status,
  statusText: code,
});

describe('OrderStore', () => {
  let store: OrderStore;
  let http: HttpTestingController;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const open = async (order: Order = draft) => {
    store.open(order.orderId);
    TestBed.tick();
    http.expectOne(`/api/orders/${order.orderId}`).flush(order);
    await settle();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(OrderStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('starts with no order, nothing loading and no error', () => {
    expect(store.orderId()).toBe('');
    expect(store.busy()).toBe(false);
    expect(store.commandError()).toBe('');
    expect(store.order()).toBeUndefined();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('');
  });

  describe('open', () => {
    it('loads the order and shows it', async () => {
      store.open('o1');
      TestBed.tick();

      expect(store.loading()).toBe(true);
      http.expectOne('/api/orders/o1').flush(draft);
      await settle();

      expect(store.loading()).toBe(false);
      expect(store.order()).toEqual(draft);
      expect(store.error()).toBe('');
    });

    it('exposes the code of a failed read and no order', async () => {
      store.open('nope');
      TestBed.tick();
      http
        .expectOne('/api/orders/nope')
        .flush(
          { statusCode: 404, code: 'ORDER_NOT_FOUND' },
          refusal(404, 'Not Found'),
        );
      await settle();

      expect(store.order()).toBeUndefined();
      expect(store.error()).toBe('ORDER_NOT_FOUND');
    });

    it('forgets the error of a command on the previous order', async () => {
      await open();
      const adding = store.addLine({ productId: 'ghost', quantity: 1 });
      http
        .expectOne('/api/orders/o1/lines')
        .flush(
          { statusCode: 422, code: 'PRODUCT_NOT_FOUND' },
          refusal(422, 'Unprocessable'),
        );
      await adding;
      expect(store.error()).toBe('PRODUCT_NOT_FOUND');

      store.open('o2');
      TestBed.tick();
      http.expectOne('/api/orders/o2').flush({ ...draft, orderId: 'o2' });
      await settle();

      expect(store.error()).toBe('');
    });
  });

  describe('create', () => {
    it('answers the id of the new order, busy while the request is in flight', async () => {
      const creating = store.create();

      expect(store.busy()).toBe(true);
      http.expectOne('/api/orders').flush({ orderId: 'o9' });

      expect(await creating).toBe('o9');
      expect(store.busy()).toBe(false);
    });

    it('answers nothing and exposes the code when the server cannot be reached', async () => {
      const creating = store.create();
      http.expectOne('/api/orders').error(new ProgressEvent('error'));

      expect(await creating).toBeUndefined();
      expect(store.error()).toBe('NETWORK_ERROR');
      expect(store.busy()).toBe(false);
    });
  });

  it('leaves the open order when it creates another, so a failed read does not linger', async () => {
    store.open('nope');
    TestBed.tick();
    http
      .expectOne('/api/orders/nope')
      .flush(
        { statusCode: 404, code: 'ORDER_NOT_FOUND' },
        refusal(404, 'Not Found'),
      );
    await settle();
    expect(store.error()).toBe('ORDER_NOT_FOUND');

    const creating = store.create();
    http.expectOne('/api/orders').flush({ orderId: 'o9' });
    await creating;

    expect(store.orderId()).toBe('');
    expect(store.error()).toBe('');
  });

  it('runs one command at a time: a second one while busy sends nothing', async () => {
    await open();

    const first = store.addLine({ productId: 'keyboard', quantity: 1 });
    expect(await store.addLine({ productId: 'keyboard', quantity: 1 })).toBe(
      false,
    );
    expect(await store.place()).toBe(false);

    http
      .expectOne('/api/orders/o1/lines')
      .flush({ ...draft, lines: [keyboard] });
    await first;

    expect(store.order()?.lines).toEqual([keyboard]);
    expect(store.busy()).toBe(false);
  });

  describe('addLine', () => {
    it('shows the order the server answers, busy while the request is in flight', async () => {
      await open();
      const added = { ...draft, lines: [keyboard] };

      const adding = store.addLine({ productId: 'keyboard', quantity: 2 });
      expect(store.busy()).toBe(true);
      const request = http.expectOne('/api/orders/o1/lines');
      expect(request.request.body).toEqual({
        productId: 'keyboard',
        quantity: 2,
      });
      request.flush(added);

      expect(await adding).toBe(true);
      expect(store.order()).toEqual(added);
      expect(store.busy()).toBe(false);
    });

    it('keeps the order and exposes the code of a refusal, then clears it on the next try', async () => {
      await open();

      const refused = store.addLine({ productId: 'ghost', quantity: 1 });
      http
        .expectOne('/api/orders/o1/lines')
        .flush(
          { statusCode: 422, code: 'PRODUCT_NOT_FOUND' },
          refusal(422, 'Unprocessable'),
        );

      expect(await refused).toBe(false);
      expect(store.order()).toEqual(draft);
      expect(store.error()).toBe('PRODUCT_NOT_FOUND');
      expect(store.busy()).toBe(false);

      const retried = store.addLine({ productId: 'keyboard', quantity: 2 });
      expect(store.error()).toBe('');
      http
        .expectOne('/api/orders/o1/lines')
        .flush({ ...draft, lines: [keyboard] });
      await retried;

      expect(store.error()).toBe('');
    });
  });

  describe.each([
    ['place', 'Placed'],
    ['cancel', 'Cancelled'],
  ] as const)('%s', (action, status) => {
    it(`sets the status to ${status} and keeps the lines`, async () => {
      await open({ ...draft, lines: [keyboard] });

      const done = store[action]();
      http
        .expectOne(`/api/orders/o1/${action}`)
        .flush({ orderId: 'o1', status });

      expect(await done).toBe(true);
      expect(store.order()).toEqual({ ...draft, status, lines: [keyboard] });
    });

    it('exposes the code of a refusal and leaves the order as it was', async () => {
      await open();

      const done = store[action]();
      http
        .expectOne(`/api/orders/o1/${action}`)
        .flush(
          { statusCode: 409, code: 'ORDER_NOT_EDITABLE' },
          refusal(409, 'Conflict'),
        );

      expect(await done).toBe(false);
      expect(store.order()).toEqual(draft);
      expect(store.error()).toBe('ORDER_NOT_EDITABLE');
    });
  });
});
