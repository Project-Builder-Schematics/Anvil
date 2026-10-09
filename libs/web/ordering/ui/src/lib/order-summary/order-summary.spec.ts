import { TestBed } from '@angular/core/testing';
import { axeViolations } from '@anvil/web-shared-design-system/testing';
import type { OrderStatus } from '@anvil/web-ordering-domain';
import { OrderSummary } from './order-summary';

describe('OrderSummary', () => {
  const render = async (status: OrderStatus = 'Draft') => {
    const fixture = TestBed.createComponent(OrderSummary);
    fixture.componentRef.setInput('orderId', 'o1');
    fixture.componentRef.setInput('status', status);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('names the order in the page heading', async () => {
    const element = await render();

    expect(element.querySelector('h1')?.textContent).toBe('Order o1');
  });

  it.each(['Draft', 'Placed', 'Cancelled'] as const)(
    'says in words that the order is %s',
    async (status) => {
      const element = await render(status);

      expect(element.querySelector('.status')?.textContent).toBe(
        `Status: ${status}`,
      );
    },
  );

  it('has no accessibility violations', async () => {
    expect(await axeViolations(await render())).toEqual([]);
  });
});
