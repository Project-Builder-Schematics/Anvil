import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EXPERIMENT_OVERRIDES, ExposureSink, SUBJECT_ID } from './experiments';
import { DsVariant } from './variant';

@Component({
  imports: [DsVariant],
  template: `<p *dsVariant="'checkout-cta'; is: 'b'">variant b</p>`,
})
class Host {}

async function render(variant: string) {
  TestBed.configureTestingModule({
    providers: [
      { provide: SUBJECT_ID, useValue: 's' },
      { provide: EXPERIMENT_OVERRIDES, useValue: { 'checkout-cta': variant } },
      { provide: ExposureSink, useValue: () => undefined },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('DsVariant', () => {
  it('renders its content for the matching variant', async () => {
    expect((await render('b')).textContent).toContain('variant b');
  });

  it('renders nothing for another variant', async () => {
    expect((await render('control')).textContent).not.toContain('variant b');
  });
});
