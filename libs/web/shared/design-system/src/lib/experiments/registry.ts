export type ExperimentStatus = 'active' | 'paused' | 'concluded';

export interface VariantDef {
  readonly name: string;
  readonly weight: number;
  /** Theme applied to `<html data-theme>` when this variant is assigned. */
  readonly theme?: string;
}

export interface ExperimentDef {
  readonly key: string;
  readonly status: ExperimentStatus;
  /** The first variant is the control, served whenever the experiment is not active. */
  readonly variants: readonly [VariantDef, ...VariantDef[]];
}

export const experiments = [
  {
    key: 'theme',
    status: 'active',
    variants: [
      { name: 'control', weight: 50, theme: 'shopify' },
      { name: 'b', weight: 50, theme: 'stripe' },
    ],
  },
  {
    key: 'checkout-cta',
    status: 'active',
    variants: [
      { name: 'control', weight: 50 },
      { name: 'b', weight: 50 },
    ],
  },
] as const satisfies readonly ExperimentDef[];

export type ExperimentKey = (typeof experiments)[number]['key'];
