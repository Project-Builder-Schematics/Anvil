import { TestBed } from '@angular/core/testing';
import {
  EXPERIMENT_OVERRIDES,
  ExposureSink,
  SUBJECT_ID,
} from '@demo/web-shared-design-system';
import { axeViolations } from '@demo/web-shared-design-system/testing';
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
    return { element, place, cancel, placed, cancelled };
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

  it('asks to place or cancel when its button is pressed', async () => {
    const { place, cancel, placed, cancelled } = await render();

    place?.click();
    expect(placed).toHaveBeenCalledOnce();
    expect(cancelled).not.toHaveBeenCalled();

    cancel?.click();
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('disables a button the status does not allow, and asks nothing of it', async () => {
    const { place, cancel, placed, cancelled } = await render({
      canPlace: false,
      canCancel: false,
    });

    expect(place?.disabled).toBe(true);
    expect(cancel?.disabled).toBe(true);
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
});
