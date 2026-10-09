import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Order } from '@anvil/web-ordering-domain';
import {
  EXPERIMENT_OVERRIDES,
  ExposureSink,
  SUBJECT_ID,
} from '@anvil/web-shared-design-system';
import { axeViolations } from '@anvil/web-shared-design-system/testing';
import { OrderPage } from './order-page';

const keyboard = {
  productId: 'keyboard',
  quantity: 1,
  unitPrice: { amount: 4500, currency: 'USD' },
};
const draft: Order = { orderId: 'o1', status: 'Draft', lines: [] };
const withLine: Order = { ...draft, lines: [keyboard] };

describe('OrderPage', () => {
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
  const button = (label: string) =>
    [...page.querySelectorAll('button')].find(
      (candidate) => candidate.textContent.trim() === label,
    );
  const answer = async (
    url: string,
    body: object | null,
    status = 200,
    code?: string,
  ) => {
    http.expectOne(url).flush(code ? { statusCode: status, code } : body, {
      status,
      statusText: String(status),
    });
    await settle();
  };
  const open = async (order: Order | null = draft) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'orders/:orderId', component: OrderPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUBJECT_ID, useValue: 'test' },
        {
          provide: EXPERIMENT_OVERRIDES,
          useValue: { 'checkout-cta': 'control' },
        },
        { provide: ExposureSink, useValue: () => undefined },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/orders/o1');
    page = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();
    if (order) await answer('/api/orders/o1', order);
  };
  const type = async (selector: string, value: string) => {
    const input = page.querySelector<HTMLInputElement>(selector);
    if (!input) throw new Error(`missing ${selector}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  afterEach(() => {
    http.verify();
  });

  it('says it is loading until the order arrives', async () => {
    await open(null);

    expect(text('[role=status]')).toBe('Loading order…');
    expect(page.querySelector('ordering-add-line-form')).toBeNull();

    await answer('/api/orders/o1', draft);

    expect(text('[role=status]')).toBe('');
  });

  it('shows the order: heading, status, lines and total', async () => {
    await open(withLine);

    expect(text('h1')).toBe('Order o1');
    expect(text('.status')).toBe('Status: Draft');
    expect(text('tbody tr')).toContain('keyboard');
    expect(text('tfoot')).toContain('$45.00');
  });

  it('tells a missing order apart, with a way to start a new one', async () => {
    await open(null);
    await answer('/api/orders/o1', null, 404, 'ORDER_NOT_FOUND');

    expect(text('[role=alert]')).toBe('We could not find that order.');
    expect(page.querySelector('ordering-add-line-form')).toBeNull();
    expect(page.querySelector('a')?.getAttribute('href')).toBe('/orders/new');
  });

  it('adds a line from the form and announces it', async () => {
    await open();
    expect(button('Place order')?.disabled).toBe(true);

    await type('#add-line-product', 'keyboard');
    button('Add line')?.click();
    await settle();
    const request = http.expectOne('/api/orders/o1/lines');
    expect(request.request.body).toEqual({
      productId: 'keyboard',
      quantity: 1,
    });
    request.flush(withLine);
    await settle();

    expect(text('tbody tr')).toContain('keyboard');
    expect(text('[role=status]')).toBe('Line added.');
    expect(text('[role=alert]')).toBe('');
    expect(button('Place order')?.disabled).toBe(false);
  });

  it('shows the human message of a refusal in the alert region, and clears it on the next success', async () => {
    await open();

    await type('#add-line-product', 'ghost');
    button('Add line')?.click();
    await settle();
    await answer('/api/orders/o1/lines', null, 422, 'PRODUCT_NOT_FOUND');

    expect(text('[role=alert]')).toBe(
      'We could not find that product. Check the product id.',
    );
    expect(text('[role=status]')).toBe('');

    await type('#add-line-product', 'keyboard');
    button('Add line')?.click();
    await settle();
    await answer('/api/orders/o1/lines', withLine);

    expect(text('[role=alert]')).toBe('');
  });

  const place = async (token = 'tok_visa') => {
    await type('#payment-token', token);
    button('Place order')?.click();
    await settle();
  };

  it('places the order with the payment token: it is paid, and editing, placing and cancelling are closed', async () => {
    await open(withLine);

    await place('  tok_visa ');
    const request = http.expectOne('/api/orders/o1/place');
    expect(request.request.body).toEqual({ paymentMethodToken: 'tok_visa' });
    request.flush({ orderId: 'o1', status: 'Paid' });
    await settle();

    expect(text('.status')).toBe('Status: Paid');
    expect(text('[role=status]')).toBe('Order paid.');
    expect(text('[role=alert]')).toBe('');
    expect(button('Place order')?.disabled).toBe(true);
    expect(button('Add line')?.disabled).toBe(true);
    expect(
      page.querySelector<HTMLInputElement>('#add-line-product')?.disabled,
    ).toBe(true);
    expect(
      page.querySelector<HTMLInputElement>('#payment-token')?.disabled,
    ).toBe(true);
    expect(button('Cancel order')?.disabled).toBe(true);
  });

  it('asks for a payment token before it places', async () => {
    await open(withLine);

    button('Place order')?.click();
    await settle();

    http.expectNone('/api/orders/o1/place');
    expect(text('#payment-token-error')).toBe('Enter a payment token.');
  });

  it.each([
    [402, 'PAYMENT_DECLINED', 'tok_decline', 'The payment was declined'],
    [409, 'INSUFFICIENT_STOCK', 'tok_visa', 'There is not enough stock'],
  ])(
    'shows the message of a %d %s and leaves a draft that can be placed again',
    async (status, code, token, message) => {
      await open(withLine);

      await place(token);
      await answer('/api/orders/o1/place', null, status, code);

      expect(text('[role=alert]')).toContain(message);
      expect(text('.status')).toBe('Status: Draft');
      expect(text('[role=status]')).toBe('');
      expect(button('Place order')?.disabled).toBe(false);
      expect(button('Cancel order')?.disabled).toBe(false);
      expect(
        page.querySelector<HTMLInputElement>('#payment-token')?.value,
      ).toBe(token);
    },
  );

  it('says the payment result is unknown after a server error, shows the order placed, and lets the user place it again', async () => {
    await open(withLine);

    await place();
    // The order is read again right away, so the app is not stable until that read is answered.
    http
      .expectOne('/api/orders/o1/place')
      .flush({ message: 'oops' }, { status: 500, statusText: 'Server Error' });
    await new Promise<void>((resolve) => setTimeout(resolve));
    harness.detectChanges();
    await answer('/api/orders/o1', { ...withLine, status: 'Placed' });

    expect(text('[role=alert]')).toContain('payment result is unknown');
    expect(text('[role=alert]')).toContain('placing the order again is safe');
    expect(text('.status')).toBe('Status: Placed');
    expect(button('Place order')?.disabled).toBe(false);
    expect(button('Cancel order')?.disabled).toBe(true);

    button('Place order')?.click();
    await settle();
    await answer('/api/orders/o1/place', { orderId: 'o1', status: 'Paid' });

    expect(text('.status')).toBe('Status: Paid');
    expect(text('[role=status]')).toBe('Order paid.');
    expect(text('[role=alert]')).toBe('');
  });

  it('lets an order left placed by an unknown payment outcome be placed again, but not cancelled (rules 17 and 19)', async () => {
    await open({ ...withLine, status: 'Placed' });

    expect(text('.status')).toBe('Status: Placed');
    expect(button('Place order')?.disabled).toBe(false);
    expect(button('Cancel order')?.disabled).toBe(true);
    expect(button('Add line')?.disabled).toBe(true);
  });

  it('cancels the order and closes every action', async () => {
    await open(withLine);

    button('Cancel order')?.click();
    await settle();
    await answer('/api/orders/o1/cancel', {
      orderId: 'o1',
      status: 'Cancelled',
    });

    expect(text('.status')).toBe('Status: Cancelled');
    expect(text('[role=status]')).toBe('Order cancelled.');
    expect(button('Cancel order')?.disabled).toBe(true);
    expect(button('Place order')?.disabled).toBe(true);
  });

  it('keeps the status as it was and shows the message when a command is refused', async () => {
    await open(withLine);

    button('Cancel order')?.click();
    await settle();
    await answer('/api/orders/o1/cancel', null, 409, 'ORDER_NOT_CANCELLABLE');

    expect(text('.status')).toBe('Status: Draft');
    expect(text('[role=alert]')).toBe('This order cannot be cancelled.');
    expect(text('[role=status]')).toBe('');
  });

  describe('when the route moves to another order', () => {
    const goToSecond = async () => {
      await harness.navigateByUrl('/orders/o2');
      harness.detectChanges();
      await answer('/api/orders/o2', { ...draft, orderId: 'o2' });
    };

    it('forgets the notice of the previous order', async () => {
      await open();
      await type('#add-line-product', 'keyboard');
      button('Add line')?.click();
      await settle();
      await answer('/api/orders/o1/lines', withLine);
      expect(text('[role=status]')).toBe('Line added.');

      await goToSecond();

      expect(text('h1')).toBe('Order o2');
      expect(text('[role=status]')).toBe('');
    });

    it('does not announce a command that finishes on the previous order', async () => {
      await open();
      await type('#add-line-product', 'keyboard');
      button('Add line')?.click();
      await settle();

      await goToSecond();
      await answer('/api/orders/o1/lines', withLine);

      expect(text('h1')).toBe('Order o2');
      expect(text('[role=status]')).toBe('');
      expect(text('tbody tr')).toContain('No lines yet.');
    });
  });

  it('has no accessibility violations: loaded, refused, missing', async () => {
    await open(withLine);
    expect(await axeViolations(page)).toEqual([]);

    button('Cancel order')?.click();
    await settle();
    await answer('/api/orders/o1/cancel', null, 409, 'ORDER_NOT_CANCELLABLE');
    expect(await axeViolations(page)).toEqual([]);

    await place('tok_decline');
    await answer('/api/orders/o1/place', null, 402, 'PAYMENT_DECLINED');
    expect(await axeViolations(page)).toEqual([]);
  });

  it('has no accessibility violations when the order is missing', async () => {
    await open(null);
    await answer('/api/orders/o1', null, 404, 'ORDER_NOT_FOUND');

    expect(await axeViolations(page)).toEqual([]);
  });
});
