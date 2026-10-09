import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';
import { parseOverrides } from './overrides';

export interface Exposure {
  experiment: string;
  variant: string;
  subjectId: string;
}

const SUBJECT_KEY = 'ds-subject-id';
const OVERRIDES_KEY = 'ds-exp-overrides';

/** Anonymous id kept in localStorage until authentication provides a real subject. */
export const SUBJECT_ID = new InjectionToken<string>('SUBJECT_ID', {
  factory: () => {
    const storage = inject(DOCUMENT).defaultView?.localStorage;
    const existing = storage?.getItem(SUBJECT_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    storage?.setItem(SUBJECT_KEY, created);
    return created;
  },
});

/** Query-string overrides, persisted for the session so they survive in-app navigation. */
export const EXPERIMENT_OVERRIDES = new InjectionToken<Record<string, string>>(
  'EXPERIMENT_OVERRIDES',
  {
    factory: () => {
      const view = inject(DOCUMENT).defaultView;
      const stored = JSON.parse(
        view?.sessionStorage.getItem(OVERRIDES_KEY) ?? '{}',
      ) as Record<string, string>;
      const merged = {
        ...stored,
        ...parseOverrides(view?.location.search ?? ''),
      };
      view?.sessionStorage.setItem(OVERRIDES_KEY, JSON.stringify(merged));
      return merged;
    },
  },
);

export const ExposureSink = new InjectionToken<(exposure: Exposure) => void>(
  'ExposureSink',
  {
    factory: () => (exposure) => {
      console.debug('exposure', exposure);
    },
  },
);
