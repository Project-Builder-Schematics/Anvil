import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');

export function parseEnvFile(text: string): Record<string, string> {
  const entries = text
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) => line !== '' && !line.startsWith('#') && line.includes('='),
    )
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)] as const;
    });
  return Object.fromEntries(entries);
}

const read = (file: string) =>
  existsSync(file) ? parseEnvFile(readFileSync(file, 'utf8')) : {};

// Same precedence compose uses: process env, then .env, then the documented defaults.
export function loadInfraEnv(
  processEnv: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const defaults = read(join(ROOT, '.env.example'));
  const local = read(join(ROOT, '.env'));
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [
      key,
      processEnv[key] ?? local[key] ?? defaults[key] ?? '',
    ]),
  );
}

export function infraValue(infra: Record<string, string>, key: string): string {
  const value = infra[key];
  if (value === undefined)
    throw new Error(`.env.example does not define ${key}`);
  return value;
}
