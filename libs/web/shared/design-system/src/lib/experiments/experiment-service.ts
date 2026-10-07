import { DOCUMENT } from '@angular/common';
import {
  inject,
  Injectable,
  provideAppInitializer,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';
import { pickVariant } from './bucket';
import { EXPERIMENT_OVERRIDES, ExposureSink, SUBJECT_ID } from './experiments';
import {
  experiments,
  type ExperimentDef,
  type ExperimentKey,
} from './registry';

const definitions: readonly ExperimentDef[] = experiments;

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
  return provideAppInitializer(() => {
    inject(ExperimentService).applyThemes();
  });
}
