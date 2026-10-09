import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  EXPERIMENT_OVERRIDES,
  ExposureSink,
  SUBJECT_ID,
} from '@demo/web-shared-design-system';
import { axeViolations } from '@demo/web-shared-design-system/testing';
import { App } from './app';
import { appRoutes } from './app.routes';

describe('App', () => {
  let http: HttpTestingController;
  let page: HTMLElement;

  const visit = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUBJECT_ID, useValue: 'test' },
        { provide: EXPERIMENT_OVERRIDES, useValue: {} },
        { provide: ExposureSink, useValue: () => undefined },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  };

  afterEach(() => {
    http.verify();
  });

  it('sends the root to a new order', async () => {
    await visit('/');

    expect(TestBed.inject(Router).url).toBe('/orders/new');
    expect(page.querySelector('main ordering-order-new')).not.toBeNull();
    http.expectOne('/api/orders');
  });

  it('loads the order page for an order id', async () => {
    await visit('/orders/o1');

    expect(page.querySelector('main ordering-order-page')).not.toBeNull();
    http.expectOne('/api/orders/o1');
  });

  it('loads the stock page for a product id', async () => {
    await visit('/stock/keyboard');

    expect(page.querySelector('main inventory-stock-page')).not.toBeNull();
    http.expectOne('/api/stock/keyboard');
  });

  it.each(['/orders/o1', '/stock/keyboard'])(
    'has no accessibility violations on %s',
    async (url) => {
      await visit(url);
      http.expectOne(`/api${url}`);

      expect(await axeViolations(page)).toEqual([]);
    },
  );
});
