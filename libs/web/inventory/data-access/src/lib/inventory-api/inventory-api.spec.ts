import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StockLevel } from '@demo/web-inventory-domain';
import { InventoryApi } from './inventory-api';

const level: StockLevel = { productId: 'keyboard', onHand: 50, reserved: 0 };

describe('InventoryApi', () => {
  let api: InventoryApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(InventoryApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('puts the on-hand level and answers the stock level', () => {
    let result: unknown;
    api.setLevel('keyboard', 7).subscribe((value) => (result = value));

    const request = http.expectOne('/api/stock/keyboard');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ onHand: 7 });
    request.flush({ ...level, onHand: 7 });

    expect(result).toEqual({ ...level, onHand: 7 });
  });

  it('encodes the product id in the path', () => {
    api.setLevel('a/b c', 1).subscribe();

    http.expectOne('/api/stock/a%2Fb%20c').flush({});
  });

  describe('stock', () => {
    it('reads the stock level with a GET once it has a product id', async () => {
      const id = signal<string | undefined>(undefined);
      const resource = TestBed.runInInjectionContext(() => api.stock(id));
      TestBed.tick();

      http.expectNone('/api/stock/keyboard');
      expect(resource.value()).toBeUndefined();

      id.set('keyboard');
      TestBed.tick();
      http.expectOne('/api/stock/keyboard').flush(level);
      await TestBed.inject(ApplicationRef).whenStable();

      expect(resource.value()).toEqual(level);
    });
  });
});
