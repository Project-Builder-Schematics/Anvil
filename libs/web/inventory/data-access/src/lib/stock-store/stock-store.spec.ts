import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StockLevel } from '@anvil/web-inventory-domain';
import { StockStore } from './stock-store';

const keyboard: StockLevel = { productId: 'keyboard', onHand: 50, reserved: 0 };
const refusal = (status: number) => ({ status, statusText: String(status) });
const notStocked = { statusCode: 404, code: 'PRODUCT_NOT_STOCKED' };

describe('StockStore', () => {
  let store: StockStore;
  let http: HttpTestingController;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const open = async (productId = 'keyboard', body: object = keyboard) => {
    store.open(productId);
    TestBed.tick();
    http.expectOne(`/api/stock/${productId}`).flush(body);
    await settle();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(StockStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('starts with no product, nothing loading and no error', () => {
    expect(store.productId()).toBe('');
    expect(store.busy()).toBe(false);
    expect(store.commandError()).toBe('');
    expect(store.level()).toBeUndefined();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('');
  });

  describe('open', () => {
    it('loads the stock level and shows it', async () => {
      store.open('keyboard');
      TestBed.tick();

      expect(store.loading()).toBe(true);
      http.expectOne('/api/stock/keyboard').flush(keyboard);
      await settle();

      expect(store.loading()).toBe(false);
      expect(store.level()).toEqual(keyboard);
      expect(store.error()).toBe('');
    });

    it('exposes the code of a product with no record and no level', async () => {
      store.open('ghost');
      TestBed.tick();
      http.expectOne('/api/stock/ghost').flush(notStocked, refusal(404));
      await settle();

      expect(store.level()).toBeUndefined();
      expect(store.error()).toBe('PRODUCT_NOT_STOCKED');
    });

    it('forgets the error of a command on the previous product', async () => {
      await open();
      const setting = store.setLevel(-1);
      http
        .expectOne('/api/stock/keyboard')
        .flush({ statusCode: 422, code: 'STOCK_LEVEL_INVALID' }, refusal(422));
      await setting;
      expect(store.error()).toBe('STOCK_LEVEL_INVALID');

      await open('mouse', { ...keyboard, productId: 'mouse' });

      expect(store.error()).toBe('');
    });
  });

  describe('setLevel', () => {
    it('shows the level the server answers, busy while the request is in flight', async () => {
      await open();

      const setting = store.setLevel(7);
      expect(store.busy()).toBe(true);
      const request = http.expectOne('/api/stock/keyboard');
      expect(request.request.body).toEqual({ onHand: 7 });
      request.flush({ ...keyboard, onHand: 7 });

      expect(await setting).toBe(true);
      expect(store.level()).toEqual({ ...keyboard, onHand: 7 });
      expect(store.busy()).toBe(false);
    });

    it('creates the record of a product that had none (rule 7)', async () => {
      store.open('lamp');
      TestBed.tick();
      http.expectOne('/api/stock/lamp').flush(notStocked, refusal(404));
      await settle();
      expect(store.error()).toBe('PRODUCT_NOT_STOCKED');

      const setting = store.setLevel(4);
      http
        .expectOne('/api/stock/lamp')
        .flush({ productId: 'lamp', onHand: 4, reserved: 0 });

      expect(await setting).toBe(true);
      expect(store.level()).toEqual({
        productId: 'lamp',
        onHand: 4,
        reserved: 0,
      });
      expect(store.error()).toBe('');
    });

    it('keeps the level and exposes the code of a refusal, then clears it on the next try', async () => {
      await open();

      const refused = store.setLevel(-1);
      http
        .expectOne('/api/stock/keyboard')
        .flush({ statusCode: 422, code: 'STOCK_LEVEL_INVALID' }, refusal(422));

      expect(await refused).toBe(false);
      expect(store.level()).toEqual(keyboard);
      expect(store.error()).toBe('STOCK_LEVEL_INVALID');
      expect(store.busy()).toBe(false);

      const retried = store.setLevel(9);
      expect(store.error()).toBe('');
      http.expectOne('/api/stock/keyboard').flush({ ...keyboard, onHand: 9 });
      await retried;

      expect(store.error()).toBe('');
    });

    it('sends nothing for a second command and says so', async () => {
      await open();

      const first = store.setLevel(7);
      expect(await store.setLevel(8)).toBe(false);
      expect(store.error()).toBe('COMMAND_IN_PROGRESS');

      http.expectOne('/api/stock/keyboard').flush({ ...keyboard, onHand: 7 });
      await first;

      expect(store.level()?.onHand).toBe(7);
      expect(store.error()).toBe('');
    });

    it('does not put a level on the other product when it lands after another was opened', async () => {
      await open();
      const setting = store.setLevel(7);
      await open('mouse', { ...keyboard, productId: 'mouse' });

      http.expectOne('/api/stock/keyboard').flush({ ...keyboard, onHand: 7 });

      expect(await setting).toBe(false);
      expect(store.level()).toEqual({ ...keyboard, productId: 'mouse' });
      expect(store.commandError()).toBe('');
    });
  });
});
