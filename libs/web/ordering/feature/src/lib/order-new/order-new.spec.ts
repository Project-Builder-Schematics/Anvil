import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { axeViolations } from '@demo/web-shared-design-system/testing';
import { OrderNew } from './order-new';

@Component({ template: '' })
class Created {}

describe('OrderNew', () => {
  let http: HttpTestingController;
  let page: HTMLElement;
  let harness: RouterTestingHarness;

  // The command's own promise continues in a later task than the flushed response.
  const settle = async () => {
    await new Promise<void>((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
  };
  const text = (selector: string) =>
    page.querySelector(selector)?.textContent.trim();
  const open = async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'orders/new', component: OrderNew },
          { path: 'orders/:orderId', component: Created },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/orders/new');
    page = harness.routeNativeElement as HTMLElement;
    await settle();
  };

  afterEach(() => {
    http.verify();
  });

  it('creates an order and goes to it', async () => {
    await open();
    expect(text('h1')).toBe('New order');
    expect(text('[role=status]')).toBe('Creating your order…');

    http.expectOne('/api/orders').flush({ orderId: 'o9' });
    await settle();

    expect(TestBed.inject(Router).url).toBe('/orders/o9');
  });

  it('shows why it failed and offers to try again', async () => {
    await open();
    http.expectOne('/api/orders').error(new ProgressEvent('error'));
    await settle();

    expect(text('[role=alert]')).toBe(
      'We could not reach the server. Check your connection and try again.',
    );
    expect(text('[role=status]')).toBe('');
    expect(await axeViolations(page)).toEqual([]);

    page.querySelector('button')?.click();
    await settle();
    expect(text('[role=alert]')).toBe('');
    http.expectOne('/api/orders').flush({ orderId: 'o9' });
    await settle();

    expect(TestBed.inject(Router).url).toBe('/orders/o9');
  });

  it('has no accessibility violations while it creates the order', async () => {
    await open();

    expect(await axeViolations(page)).toEqual([]);
    http.expectOne('/api/orders').flush({ orderId: 'o9' });
  });
});
