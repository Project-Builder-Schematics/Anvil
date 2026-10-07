import { TestBed } from '@angular/core/testing';
import {
  EXPERIMENT_OVERRIDES,
  ExposureSink,
  SUBJECT_ID,
} from '@demo/web-shared-design-system';
import { App } from './app';

describe('App', () => {
  async function render(variant: string) {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SUBJECT_ID, useValue: 'test' },
        {
          provide: EXPERIMENT_OVERRIDES,
          useValue: { 'checkout-cta': variant },
        },
        { provide: ExposureSink, useValue: () => undefined },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('should render title', async () => {
    expect(
      (await render('control')).querySelector('h1')?.textContent,
    ).toContain('Welcome web');
  });

  it.each([
    ['control', 'Pay now'],
    ['b', 'Pay securely'],
  ])('renders the %s checkout CTA', async (variant, label) => {
    const compiled = await render(variant);
    expect(compiled.querySelector('ds-button')?.textContent).toContain(label);
    expect(compiled.querySelectorAll('ds-button')).toHaveLength(1);
  });
});
