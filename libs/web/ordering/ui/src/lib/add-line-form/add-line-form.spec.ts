import { TestBed } from '@angular/core/testing';
import type { AddLine } from '@anvil/web-ordering-domain';
import { axeViolations } from '@anvil/web-shared-design-system/testing';
import { AddLineForm } from './add-line-form';

describe('AddLineForm', () => {
  const render = async (disabled = false) => {
    const fixture = TestBed.createComponent(AddLineForm);
    const added: AddLine[] = [];
    fixture.componentInstance.lineAdded.subscribe((line) => added.push(line));
    fixture.componentRef.setInput('disabled', disabled);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const product =
      element.querySelector<HTMLInputElement>('#add-line-product');
    const quantity =
      element.querySelector<HTMLInputElement>('#add-line-quantity');
    const submit = element.querySelector<HTMLButtonElement>(
      'button[type=submit]',
    );
    const type = async (input: HTMLInputElement | null, value: string) => {
      if (!input) throw new Error('missing input');
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const send = async () => {
      submit?.click();
      await fixture.whenStable();
    };
    const error = (id: string) => element.querySelector(`#${id}`)?.textContent;
    return { element, product, quantity, submit, type, send, added, error };
  };

  it('labels both fields', async () => {
    const { element } = await render();

    expect(
      [...element.querySelectorAll('label')].map((label) => label.textContent),
    ).toEqual(['Product id', 'Quantity']);
  });

  it('emits the line as typed, with the product id trimmed', async () => {
    const { product, quantity, type, send, added } = await render();

    await type(product, '  keyboard ');
    await type(quantity, '2');
    await send();

    expect(added).toEqual([{ productId: 'keyboard', quantity: 2 }]);
  });

  it('starts with one unit', async () => {
    const { product, type, send, added } = await render();

    await type(product, 'mouse');
    await send();

    expect(added).toEqual([{ productId: 'mouse', quantity: 1 }]);
  });

  it('refuses a blank product id: says why, links the message, marks the field and focuses it', async () => {
    const { product, type, send, added, error } = await render();

    await type(product, '   ');
    await send();

    expect(added).toEqual([]);
    expect(error('add-line-product-error')).toBe('Enter a product id.');
    expect(product?.getAttribute('aria-describedby')).toBe(
      'add-line-product-hint add-line-product-error',
    );
    expect(product?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(product);
  });

  it.each(['0', '100', '1.5', '-3', ''])(
    'refuses the quantity "%s" with the rule-2 message and keeps the hint linked',
    async (value) => {
      const { product, quantity, type, send, added, error } = await render();

      await type(product, 'keyboard');
      await type(quantity, value);
      await send();

      expect(added).toEqual([]);
      expect(error('add-line-quantity-error')).toBe(
        'Enter a whole number from 1 to 99.',
      );
      expect(quantity?.getAttribute('aria-describedby')).toBe(
        'add-line-quantity-hint add-line-quantity-error',
      );
      expect(quantity?.getAttribute('aria-invalid')).toBe('true');
    },
  );

  it.each(['1', '99'])('accepts the quantity %s', async (value) => {
    const { product, quantity, type, send, added } = await render();

    await type(product, 'keyboard');
    await type(quantity, value);
    await send();

    expect(added).toEqual([{ productId: 'keyboard', quantity: Number(value) }]);
  });

  it('names the demo products in a hint linked to the product field', async () => {
    const { product } = await render();

    expect(
      document.getElementById('add-line-product-hint')?.textContent.trim(),
    ).toBe('Demo products: keyboard, mouse, monitor.');
    expect(product?.getAttribute('aria-describedby')).toBe(
      'add-line-product-hint',
    );
  });

  it('shows no error before the user has touched a field', async () => {
    const { error, quantity } = await render();

    expect(error('add-line-product-error')).toBeUndefined();
    expect(error('add-line-quantity-error')).toBeUndefined();
    expect(quantity?.getAttribute('aria-describedby')).toBe(
      'add-line-quantity-hint',
    );
    expect(quantity?.getAttribute('aria-invalid')).toBeNull();
  });

  it('disables the fields and the button while disabled', async () => {
    const { product, quantity, submit } = await render(true);

    expect(product?.disabled).toBe(true);
    expect(quantity?.disabled).toBe(true);
    expect(submit?.disabled).toBe(true);
  });

  it('has no accessibility violations: idle, with errors, disabled', async () => {
    const idle = await render();
    expect(await axeViolations(idle.element)).toEqual([]);

    await idle.type(idle.product, ' ');
    await idle.type(idle.quantity, '0');
    await idle.send();
    expect(await axeViolations(idle.element)).toEqual([]);

    expect(await axeViolations((await render(true)).element)).toEqual([]);
  });
});
