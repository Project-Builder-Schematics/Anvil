import { TestBed } from '@angular/core/testing';
import { Button } from './button';

describe('Button', () => {
  it('projects its label into a native button', async () => {
    const fixture = TestBed.createComponent(Button);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    );
    expect(button?.getAttribute('type')).toBe('button');
  });
});
