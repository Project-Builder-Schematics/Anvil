import { DOCUMENT } from '@angular/common';
import {
  inject,
  Injectable,
  InjectionToken,
  provideAppInitializer,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';
import { pickVariant } from './bucket';
import { parseOverrides } from './overrides';
import {
  experiments,
  type ExperimentDef,
  type ExperimentKey,
} from './registry';

const definitions: readonly ExperimentDef[] = experiments;

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
    factory: () => (exposure) => console.debug('exposure', exposure),
  },
);

@Injectable({ providedIn: 'root' })
export class ExperimentService {
  private readonly document = inject(DOCUMENT);
  private readonly subjectId = inject(SUBJECT_ID);
  private readonly overrides = inject(EXPERIMENT_OVERRIDES);
  private readonly sink = inject(ExposureSink);
  private readonly assigned = new Map<ExperimentKey, Signal<string>>();

  /** Returns the assigned variant; the first read of a key emits its exposure. */
  variant(key: ExperimentKey): Signal<string> {
    const cached = this.assigned.get(key);
    if (cached) return cached;

    const experiment = definitions.find((candidate) => candidate.key === key);
    if (!experiment) throw new Error(`Unknown experiment ${key}`);

    const forced = experiment.variants.find(
      (variant) => variant.name === this.overrides[key],
    );
    const chosen =
      forced ??
      (experiment.status === 'active'
        ? pickVariant(key, this.subjectId, experiment.variants)
        : experiment.variants[0]);

    this.sink({
      experiment: key,
      variant: chosen.name,
      subjectId: this.subjectId,
    });
    const variant = signal<string>(chosen.name).asReadonly();
    this.assigned.set(key, variant);
    return variant;
  }

  /** Sets `data-theme` for every experiment whose variants carry a theme. */
  applyThemes(): void {
    for (const experiment of definitions.filter((candidate) =>
      candidate.variants.some((variant) => variant.theme),
    )) {
      const name = this.variant(experiment.key as ExperimentKey)();
      const theme = experiment.variants.find(
        (variant) => variant.name === name,
      )?.theme;
      if (theme)
        this.document.documentElement.setAttribute('data-theme', theme);
    }
  }
}

export function provideExperiments(): EnvironmentProviders {
  return provideAppInitializer(() => inject(ExperimentService).applyThemes());
}
