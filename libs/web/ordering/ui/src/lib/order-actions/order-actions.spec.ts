import { TestBed } from '@angular/core/testing';
import {
  EXPERIMENT_OVERRIDES,
  ExposureSink,
  SUBJECT_ID,
} from '@anvil/web-shared-design-system';
import { axeViolations } from '@anvil/web-shared-design-system/testing';
import { OrderActions } from './order-actions';

describe('OrderActions', () => {
  const render = async (
    flags: { canPlace?: boolean; canCancel?: boolean; busy?: boolean } = {},
    variant = 'control',
  ) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SUBJECT_ID, useValue: 'test' },
        {
          provide: EXPERIMENT_OVERRIDES,
          useValue: { 'checkout-cta': variant },
        },
        { provide: ExposureSink, useValue: () => undefined },
      ],
    });
    const fixture = TestBed.createComponent(OrderActions);
    const placed = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.placeOrder.subscribe(placed);
    fixture.componentInstance.cancelOrder.subscribe(cancelled);
    fixture.componentRef.setInput('canPlace', flags.canPlace ?? true);
    fixture.componentRef.setInput('canCancel', flags.canCancel ?? true);
    fixture.componentRef.setInput('busy', flags.busy ?? false);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const [place, cancel] = [...element.querySelectorAll('button')];
    const token = element.querySelector<HTMLInputElement>('#payment-token');
    const type = async (value: string) => {
      if (!token) throw new Error('missing token field');
      token.value = value;
      token.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const send = async () => {
      place?.click();
      await fixture.whenStable();
    };
    const error = () =>
      element.querySelector('#payment-token-error')?.textContent;
    return {
      element,
      place,
      cancel,
      placed,
      cancelled,
      token,
      type,
      send,
      error,
    };
  };

  it.each([
    ['control', 'Place order'],
    ['b', 'Place order securely'],
  ])(
    'labels the place button for the %s checkout variant',
    async (variant, label) => {
      const { place, element } = await render({}, variant);

      expect(place?.textContent).toBe(label);
      expect(element.querySelectorAll('button')).toHaveLength(2);
    },
  );

  it('labels the token field and hints how the fake gateway reads it', async () => {
    const { element, token } = await render();

    expect(element.querySelector('label[for=payment-token]')?.textContent).toBe(
      'Payment token',
    );
    expect(token?.getAttribute('aria-describedby')).toBe('payment-token-hint');
    expect(
      element.querySelector('#payment-token-hint')?.textContent.trim(),
    ).toBe(
      'Use tok_decline to get a declined payment; any other token is captured.',
    );
  });

  it('asks to place with the token as typed, trimmed', async () => {
    const { type, send, placed, cancelled } = await render();

    await type('  tok_visa ');
    await send();

    expect(placed).toHaveBeenCalledExactlyOnceWith('tok_visa');
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('asks to cancel when its button is pressed, with no token needed', async () => {
    const { cancel, placed, cancelled } = await render();

    cancel?.click();

    expect(cancelled).toHaveBeenCalledOnce();
    expect(placed).not.toHaveBeenCalled();
  });

  it('refuses a blank token: says why, links the message, marks the field and focuses it', async () => {
    const { token, type, send, placed, error } = await render();

    await type('   ');
    await send();

    expect(placed).not.toHaveBeenCalled();
    expect(error()).toBe('Enter a payment token.');
    expect(token?.getAttribute('aria-describedby')).toBe(
      'payment-token-hint payment-token-error',
    );
    expect(token?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(token);
  });

  it('shows no error before the user has tried to place', async () => {
    const { token, error } = await render();

    expect(error()).toBeUndefined();
    expect(token?.getAttribute('aria-invalid')).toBeNull();
  });

  it('disables a button the status does not allow, and asks nothing of it', async () => {
    const { place, cancel, token, placed, cancelled } = await render({
      canPlace: false,
      canCancel: false,
    });

    expect(place?.disabled).toBe(true);
    expect(cancel?.disabled).toBe(true);
    expect(token?.disabled).toBe(true);
    place?.click();
    cancel?.click();
    expect(placed).not.toHaveBeenCalled();
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('disables both buttons while a command is in flight', async () => {
    const { place, cancel } = await render({ busy: true });

    expect(place?.disabled).toBe(true);
    expect(cancel?.disabled).toBe(true);
  });

  it.each([{}, { canPlace: false, canCancel: false }, { busy: true }])(
    'has no accessibility violations for %j',
    async (flags) => {
      expect(await axeViolations((await render(flags)).element)).toEqual([]);
    },
  );

  it('has no accessibility violations with the token error showing', async () => {
    const { element, send } = await render();

    await send();

    expect(await axeViolations(element)).toEqual([]);
  });
});
