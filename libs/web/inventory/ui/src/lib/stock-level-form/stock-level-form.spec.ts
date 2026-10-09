import { TestBed } from '@angular/core/testing';
import { axeViolations } from '@demo/web-shared-design-system/testing';
import { StockLevelForm } from './stock-level-form';

describe('StockLevelForm', () => {
  const render = async () => {
    const fixture = TestBed.createComponent(StockLevelForm);
    const set: number[] = [];
    fixture.componentInstance.levelSet.subscribe((level) => set.push(level));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const level = element.querySelector<HTMLInputElement>('#stock-level');
    const submit = element.querySelector<HTMLButtonElement>(
      'button[type=submit]',
    );
    const type = async (value: string) => {
      if (!level) throw new Error('missing input');
      level.value = value;
      level.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const send = async () => {
      submit?.click();
      await fixture.whenStable();
    };
    const error = () =>
      element.querySelector('#stock-level-error')?.textContent;
    return { element, level, submit, type, send, set, error };
  };

  it('labels the field and hints the rules', async () => {
    const { element, level } = await render();

    expect(element.querySelector('label[for=stock-level]')?.textContent).toBe(
      'Units on hand',
    );
    expect(level?.getAttribute('aria-describedby')).toBe('stock-level-hint');
    expect(element.querySelector('#stock-level-hint')?.textContent.trim()).toBe(
      'A whole number of 0 or more, not below the units already reserved.',
    );
  });

  it.each(['0', '7', '1000'])('emits the level %s', async (value) => {
    const { type, send, set } = await render();

    await type(value);
    await send();

    expect(set).toEqual([Number(value)]);
  });

  it.each(['', '-1', '1.5'])(
    'refuses the level "%s": says why, links the message, marks the field and focuses it',
    async (value) => {
      const { level, type, send, set, error } = await render();

      await type(value);
      await send();

      expect(set).toEqual([]);
      expect(error()).toBe('Enter a whole number of 0 or more.');
      expect(level?.getAttribute('aria-describedby')).toBe(
        'stock-level-hint stock-level-error',
      );
      expect(level?.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(level);
    },
  );

  it('shows no error before the user has tried to send', async () => {
    const { level, error } = await render();

    expect(error()).toBeUndefined();
    expect(level?.getAttribute('aria-invalid')).toBeNull();
  });

  it('has no accessibility violations: idle and with the error showing', async () => {
    const idle = await render();
    expect(await axeViolations(idle.element)).toEqual([]);

    await idle.type('-1');
    await idle.send();
    expect(await axeViolations(idle.element)).toEqual([]);
  });
});
