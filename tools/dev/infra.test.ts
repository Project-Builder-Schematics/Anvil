import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadInfraEnv, parseEnvFile } from './infra';

describe('parseEnvFile', () => {
  it('reads KEY=VALUE lines and skips comments and blanks', () => {
    expect(
      parseEnvFile('# note\n\nDB_USER=demo\nURL=http://a/?x=1\n  # indented\n'),
    ).toEqual({ DB_USER: 'demo', URL: 'http://a/?x=1' });
  });
});

describe('loadInfraEnv', () => {
  it('lets the process environment win over the documented defaults', () => {
    const defaults = loadInfraEnv({});
    expect(defaults['DB_USER']).toBe('demo');
    expect(loadInfraEnv({ DB_USER: 'other' })['DB_USER']).toBe('other');
  });
});

describe('.env.example and docker-compose.yml', () => {
  it('document the same defaults, in both directions', () => {
    const documented = loadInfraEnv({});
    const compose = readFileSync(
      join(import.meta.dir, '../../docker-compose.yml'),
      'utf8',
    );
    const used = Object.fromEntries(
      [...compose.matchAll(/\$\{(\w+):-([^}]*)\}/g)].map(
        (m): [string, string] => [m[1] ?? '', m[2] ?? ''],
      ),
    );
    expect(used).toEqual(documented);
  });
});
