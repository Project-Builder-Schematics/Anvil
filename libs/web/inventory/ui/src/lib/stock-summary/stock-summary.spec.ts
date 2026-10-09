import { TestBed } from '@angular/core/testing';
import type { StockLevel } from '@demo/web-inventory-domain';
import { axeViolations } from '@demo/web-shared-design-system/testing';
import { StockSummary } from './stock-summary';

describe('StockSummary', () => {
  const render = async (level: StockLevel) => {
    const fixture = TestBed.createComponent(StockSummary);
    fixture.componentRef.setInput('level', level);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };
  const terms = (element: HTMLElement) =>
    Object.fromEntries(
      [...element.querySelectorAll('dt')].map((term) => [
        term.textContent.trim(),
        term.nextElementSibling?.textContent.trim(),
      ]),
    );

  it('shows what is on hand, what is reserved and what is available', async () => {
    const element = await render({
      productId: 'keyboard',
      onHand: 50,
      reserved: 12,
    });

    expect(terms(element)).toEqual({
      'On hand': '50',
      Reserved: '12',
      Available: '38',
    });
  });

  it('has no accessibility violations', async () => {
    const element = await render({
      productId: 'keyboard',
      onHand: 7,
      reserved: 7,
    });

    expect(await axeViolations(element)).toEqual([]);
  });
});
