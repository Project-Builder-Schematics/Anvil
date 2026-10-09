export const colorTokens = [
  'primary',
  'primary-hover',
  'on-primary',
  'canvas',
  'surface',
  'surface-strong',
  'ink',
  'body',
  'muted',
  'border',
  'danger',
  'success',
] as const;

export const typeRoles = ['display', 'title', 'body', 'caption'] as const;
export const typeProps = [
  'family',
  'size',
  'weight',
  'line-height',
  'letter-spacing',
] as const;
export const radiusTokens = ['sm', 'md', 'lg', 'full'] as const;
export const spaceTokens = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export const contractTokens: readonly string[] = [
  ...colorTokens.map((name) => `color.${name}`),
  ...typeRoles.map((role) => `type.${role}`),
  ...radiusTokens.map((name) => `radius.${name}`),
  ...spaceTokens.map((name) => `space.${name}`),
];

export const contractVars: readonly string[] = [
  ...colorTokens.map((name) => `--ds-color-${name}`),
  ...typeRoles.flatMap((role) =>
    typeProps.map((prop) => `--ds-type-${role}-${prop}`),
  ),
  ...radiusTokens.map((name) => `--ds-radius-${name}`),
  ...spaceTokens.map((name) => `--ds-space-${name}`),
];
