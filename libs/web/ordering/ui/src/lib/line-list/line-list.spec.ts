import { TestBed } from '@angular/core/testing';
import type { OrderLine } from '@anvil/web-ordering-domain';
import { axeViolations } from '@anvil/web-shared-design-system/testing';
import { LineList } from './line-list';

const keyboard: OrderLine = {
  productId: 'keyboard',
  quantity: 2,
  unitPrice: { amount: 4500, currency: 'USD' },
};
const mouse: OrderLine = {
  productId: 'mouse',
  quantity: 1,
  unitPrice: { amount: 1500, currency: 'USD' },
};

describe('LineList', () => {
  const render = async (lines: OrderLine[]) => {
    const fixture = TestBed.createComponent(LineList);
    fixture.componentRef.setInput('lines', lines);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };
  const cells = (row: Element) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent);

  it('shows the product, quantity, unit price and line total of each line', async () => {
    const element = await render([keyboard, mouse]);

    expect([...element.querySelectorAll('tbody tr')].map(cells)).toEqual([
      ['keyboard', '2', '$45.00', '$90.00'],
      ['mouse', '1', '$15.00', '$15.00'],
    ]);
  });

  it('shows every line without a duplicate-key warning when a product repeats', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(LineList);
    fixture.componentRef.setInput('lines', [keyboard, mouse]);
    await fixture.whenStable();
    fixture.componentRef.setInput('lines', [mouse, { ...mouse }]);
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'),
    ).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('shows the order total', async () => {
    const element = await render([keyboard, mouse]);

    expect(cells(element.querySelector('tfoot tr') as Element)).toEqual([
      'Total',
      '$105.00',
    ]);
  });

  it('says so when there are no lines, and shows no total', async () => {
    const element = await render([]);

    expect(element.querySelector('tbody')?.textContent).toContain(
      'No lines yet.',
    );
    expect(element.querySelector('tfoot')).toBeNull();
  });

  it.each([[[]], [[keyboard, mouse]]])(
    'has no accessibility violations for %j',
    async (lines) => {
      expect(await axeViolations(await render(lines))).toEqual([]);
    },
  );
});
