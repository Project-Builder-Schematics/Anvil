import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { OrderNew } from './order-new/order-new';
import { OrderPage } from './order-page/order-page';
import { orderingRoutes } from './ordering.routes';

describe('orderingRoutes', () => {
  it('reads "new" as the new-order page, then goes to the page of the order it created', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'orders', children: orderingRoutes }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/orders/new', OrderNew);
    http.expectOne('/api/orders').flush({ orderId: 'o1' });
    await new Promise<void>((resolve) => setTimeout(resolve));
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/orders/o1');
    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(
      OrderPage,
    );
    http.expectOne('/api/orders/o1');
  });
});
