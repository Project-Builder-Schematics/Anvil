import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');

const BLANK = /[ \t]*(?:#[^\n]*)?(?:\n|$)/y;
// Quoted values may span lines; an unquoted one ends at the line end or at a comment preceded by a space.
const ENTRY =
  /[ \t]*([A-Za-z_][\w.-]*)[ \t]*[=:][ \t]*(?:(?:'([^']*)'|"((?:[^"\\]|\\[\s\S])*)")[ \t]*(?:#[^\n]*)?|([^\n'"][^\n]*)?)(?:\n|$)/y;
const ESCAPES: Record<string, string> = { n: '\n', r: '\r' };

/**
 * Reads the subset of the compose env-file syntax this repo uses: `KEY=VALUE` or `KEY: VALUE`,
 * single- and double-quoted values, `#` comments. `${…}` interpolation is refused, not skipped.
 */
export function parseEnvFile(source: string): Record<string, string> {
  const text = source.replace(/\r\n/g, '\n');
  const env: Record<string, string> = {};
  for (let pos = 0; pos < text.length;) {
    BLANK.lastIndex = pos;
    const blank = BLANK.exec(text);
    if (blank) {
      pos += blank[0].length;
      continue;
    }
    ENTRY.lastIndex = pos;
    const entry = ENTRY.exec(text);
    const line = text.slice(0, pos).split('\n').length;
    if (!entry) throw new Error(`line ${line}: expected KEY=VALUE`);
    const [matched, key = '', single, double, bare] = entry;
    const value =
      single ??
      double?.replace(/\\([nr"\\])/g, (_m, c: string) => ESCAPES[c] ?? c) ??
      (bare ?? '').replace(/(^|\s)#.*$/, '').trim();
    if (single === undefined && /\$/.test(double ?? bare ?? ''))
      throw new Error(
        `line ${line}: ${key} uses interpolation, which compose expands and this reader does not`,
      );
    env[key] = value;
    pos += matched.length;
  }
  return env;
}

function read(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  try {
    return parseEnvFile(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `${basename(file)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Compose resolves `${VAR:-default}` from the shell, then .env, then the default written in
// docker-compose.yml, which .env.example repeats. An empty value counts as unset, as `:-` does.
export function loadInfraEnv(
  processEnv: Record<string, string | undefined> = process.env,
  root: string = ROOT,
): Record<string, string> {
  const defaults = read(join(root, '.env.example'));
  const local = read(join(root, '.env'));
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [
      key,
      processEnv[key] || local[key] || defaults[key] || '',
    ]),
  );
}

export function infraValue(infra: Record<string, string>, key: string): string {
  const value = infra[key];
  if (value === undefined)
    throw new Error(`.env.example does not define ${key}`);
  return value;
}

export function sharedPorts(infra: Record<string, string>): number[] {
  return [
    Number(infraValue(infra, 'DB_PORT')),
    Number(infraValue(infra, 'PGADMIN_PORT')),
  ];
}

// The compose file publishes the database on 127.0.0.1; `localhost` can resolve to ::1 instead.
export function databaseUrl(
  infra: Record<string, string>,
  dbName: string,
): string {
  const user = encodeURIComponent(infraValue(infra, 'DB_USER'));
  const password = encodeURIComponent(infraValue(infra, 'DB_PASSWORD'));
  return `postgres://${user}:${password}@127.0.0.1:${infraValue(infra, 'DB_PORT')}/${dbName}`;
}
