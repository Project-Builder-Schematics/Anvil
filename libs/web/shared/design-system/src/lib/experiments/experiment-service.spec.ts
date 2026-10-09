import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { ExperimentService } from './experiment-service';
import {
  EXPERIMENT_OVERRIDES,
  ExposureSink,
  SUBJECT_ID,
  type Exposure,
} from './experiments';

function setup(
  overrides: Record<string, string> = {},
  subjectId = 'subject-1',
) {
  const exposures: Exposure[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: SUBJECT_ID, useValue: subjectId },
      { provide: EXPERIMENT_OVERRIDES, useValue: overrides },
      {
        provide: ExposureSink,
        useValue: (exposure: Exposure) => exposures.push(exposure),
      },
    ],
  });
  return {
    service: TestBed.inject(ExperimentService),
    exposures,
    document: TestBed.inject(DOCUMENT),
  };
}

describe('ExperimentService', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('assigns the same variant to the same subject', () => {
    const { service } = setup();
    expect(service.variant('checkout-cta')()).toBe(
      service.variant('checkout-cta')(),
    );
  });

  it('lets an override force a variant', () => {
    const { service } = setup({ 'checkout-cta': 'b', theme: 'b' });
    expect(service.variant('checkout-cta')()).toBe('b');
    expect(service.variant('theme')()).toBe('b');
  });

  it('ignores an override naming an unknown variant', () => {
    const { service } = setup({ 'checkout-cta': 'nope' });
    expect(['control', 'b']).toContain(service.variant('checkout-cta')());
  });

  it('applies the theme of the assigned variant to the document', () => {
    const { service, document } = setup({ theme: 'b' });
    service.applyThemes();
    expect(document.documentElement.getAttribute('data-theme')).toBe('stripe');
  });

  it('leaves the document alone for experiments without a theme', () => {
    const { service, exposures, document } = setup({ theme: 'control' });
    service.applyThemes();
    expect(document.documentElement.getAttribute('data-theme')).toBe('shopify');
    expect(exposures.map((exposure) => exposure.experiment)).toEqual(['theme']);
  });

  it('emits one exposure per experiment, however often it is read', () => {
    const { service, exposures } = setup({ 'checkout-cta': 'b' });
    service.variant('checkout-cta');
    service.variant('checkout-cta')();
    service.variant('checkout-cta')();
    expect(exposures).toEqual([
      { experiment: 'checkout-cta', variant: 'b', subjectId: 'subject-1' },
    ]);
  });
});
