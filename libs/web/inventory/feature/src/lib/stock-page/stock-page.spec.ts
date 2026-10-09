import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { StockLevel } from '@anvil/web-inventory-domain';
import { axeViolations } from '@anvil/web-shared-design-system/testing';
import { StockPage } from './stock-page';

const keyboard: StockLevel = {
  productId: 'keyboard',
  onHand: 50,
  reserved: 12,
};

describe('StockPage', () => {
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
  const open = async (level: StockLevel | null = keyboard) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'stock/:productId', component: StockPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/stock/keyboard');
    page = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();
    if (level) await answer('/api/stock/keyboard', level);
  };
  const setLevel = async (value: string) => {
    const input = page.querySelector<HTMLInputElement>('#stock-level');
    if (!input) throw new Error('missing #stock-level');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
    page.querySelector<HTMLButtonElement>('button[type=submit]')?.click();
    await settle();
  };

  afterEach(() => {
    http.verify();
  });

  it('says it is loading until the stock level arrives', async () => {
    await open(null);

    expect(text('[role=status]')).toBe('Loading stock…');
    expect(page.querySelector('inventory-stock-summary')).toBeNull();

    await answer('/api/stock/keyboard', keyboard);

    expect(text('[role=status]')).toBe('');
  });

  it('shows the product and its stock level', async () => {
    await open();

    expect(text('h1')).toBe('Stock: keyboard');
    expect(text('inventory-stock-summary')).toContain('On hand');
    expect(text('inventory-stock-summary')).toMatch(/Available\s*38/);
  });

  it('tells a product with no stock record apart, and still lets the user set its level', async () => {
    await open(null);
    await answer('/api/stock/keyboard', null, 404, 'PRODUCT_NOT_STOCKED');

    expect(text('[role=alert]')).toBe(
      'This product is not stocked yet. Set a level to start stocking it.',
    );
    expect(page.querySelector('inventory-stock-summary')).toBeNull();
    expect(page.querySelector('#stock-level')).not.toBeNull();

    await setLevel('4');
    await answer(
      '/api/stock/keyboard',
      {
        productId: 'keyboard',
        onHand: 4,
        reserved: 0,
      },
      200,
    );

    expect(text('inventory-stock-summary')).toMatch(/On hand\s*4/);
    expect(text('[role=alert]')).toBe('');
    expect(text('[role=status]')).toBe('Stock level set.');
  });

  it('sets the level and announces it', async () => {
    await open();

    await setLevel('20');
    const request = http.expectOne('/api/stock/keyboard');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ onHand: 20 });
    request.flush({ ...keyboard, onHand: 20 });
    await settle();

    expect(text('inventory-stock-summary')).toMatch(/On hand\s*20/);
    expect(text('inventory-stock-summary')).toMatch(/Available\s*8/);
    expect(text('[role=status]')).toBe('Stock level set.');
    expect(text('[role=alert]')).toBe('');
  });

  it('sends nothing for an invalid level and says why', async () => {
    await open();

    await setLevel('-1');

    http.expectNone('/api/stock/keyboard');
    expect(text('#stock-level-error')).toBe(
      'Enter a whole number of 0 or more.',
    );
  });

  it('shows the human message of a refusal in the alert region and keeps the level, then clears it on the next success', async () => {
    await open();

    await setLevel('3');
    await answer('/api/stock/keyboard', null, 422, 'STOCK_LEVEL_INVALID');

    expect(text('[role=alert]')).toContain(
      'not below the units already reserved',
    );
    expect(text('inventory-stock-summary')).toMatch(/On hand\s*50/);
    expect(text('[role=status]')).toBe('');

    await setLevel('20');
    await answer('/api/stock/keyboard', { ...keyboard, onHand: 20 });

    expect(text('[role=alert]')).toBe('');
    expect(text('inventory-stock-summary')).toMatch(/On hand\s*20/);
  });

  describe('when the route moves to another product', () => {
    const goToMouse = async () => {
      await harness.navigateByUrl('/stock/mouse');
      harness.detectChanges();
      await answer('/api/stock/mouse', {
        productId: 'mouse',
        onHand: 5,
        reserved: 0,
      });
    };

    it('forgets the notice of the previous product', async () => {
      await open();
      await setLevel('7');
      await answer('/api/stock/keyboard', { ...keyboard, onHand: 7 });
      expect(text('[role=status]')).toBe('Stock level set.');

      await goToMouse();

      expect(text('h1')).toBe('Stock: mouse');
      expect(text('[role=status]')).toBe('');
    });

    it('does not announce a command that finishes on the previous product', async () => {
      await open();
      await setLevel('7');

      await goToMouse();
      await answer('/api/stock/keyboard', { ...keyboard, onHand: 7 });

      expect(text('h1')).toBe('Stock: mouse');
      expect(text('[role=status]')).toBe('');
      expect(text('inventory-stock-summary')).toMatch(/On hand\s*5/);
    });
  });

  it('has no accessibility violations: loaded, refused, not stocked', async () => {
    await open();
    expect(await axeViolations(page)).toEqual([]);

    await setLevel('3');
    await answer('/api/stock/keyboard', null, 422, 'STOCK_LEVEL_INVALID');
    expect(await axeViolations(page)).toEqual([]);

    await setLevel('-1');
    expect(await axeViolations(page)).toEqual([]);
  });

  it('has no accessibility violations when the product is not stocked', async () => {
    await open(null);
    await answer('/api/stock/keyboard', null, 404, 'PRODUCT_NOT_STOCKED');

    expect(await axeViolations(page)).toEqual([]);
  });
});
