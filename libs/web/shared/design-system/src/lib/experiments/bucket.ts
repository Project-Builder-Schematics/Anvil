import type { VariantDef } from './registry';

/** FNV-1a: stable across runs and platforms, which `Math.random` and engine hashes are not. */
export function hash(input: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

export function pickVariant<V extends VariantDef>(
  experimentKey: string,
  subjectId: string,
  variants: readonly V[],
): V {
  const total = variants.reduce((sum, variant) => sum + variant.weight, 0);
  const point = (hash(`${experimentKey}:${subjectId}`) / 2 ** 32) * total;
  let upper = 0;
  const chosen = variants.find((variant) => {
    upper += variant.weight;
    return point < upper;
  });
  if (!chosen)
    throw new Error(
      `Experiment ${experimentKey} has no variant with a positive weight`,
    );
  return chosen;
}
