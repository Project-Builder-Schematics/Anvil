export function planDatabase(existsOutput: string): {
  create: boolean;
  seed: boolean;
} {
  const missing = existsOutput.trim() !== '1';
  return { create: missing, seed: missing };
}
