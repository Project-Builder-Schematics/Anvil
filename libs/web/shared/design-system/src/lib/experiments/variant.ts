import {
  Directive,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { ExperimentService } from './experiments';
import type { ExperimentKey } from './registry';

/** `<ng-container *dsVariant="'checkout-cta'; is: 'b'">` renders only for that variant. */
@Directive({ selector: '[dsVariant]' })
export class DsVariant {
  readonly dsVariant = input.required<ExperimentKey>();
  readonly dsVariantIs = input.required<string>();

  private readonly experiments = inject(ExperimentService);
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  constructor() {
    // Imperative view creation is the one thing a structural directive cannot express reactively.
    effect(() => {
      this.container.clear();
      if (this.experiments.variant(this.dsVariant())() === this.dsVariantIs()) {
        this.container.createEmbeddedView(this.template);
      }
    });
  }
}
