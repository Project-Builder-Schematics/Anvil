/** Parses `?exp=key:variant[,key:variant]`; malformed pairs are ignored. */
export function parseOverrides(search: string): Record<string, string> {
  const raw = new URLSearchParams(search).get('exp') ?? '';
  const overrides: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [key, variant] = pair.split(':');
    if (key && variant) overrides[key] = variant;
  }
  return overrides;
}
