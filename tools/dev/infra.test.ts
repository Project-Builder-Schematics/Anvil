import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { databaseUrl, loadInfraEnv, parseEnvFile, sharedPorts } from './infra';

describe('parseEnvFile', () => {
  it('reads KEY=VALUE lines and skips comments and blanks', () => {
    expect(
      parseEnvFile('# note\n\nDB_USER=demo\nURL=http://a/?x=1\n  # indented\n'),
    ).toEqual({ DB_USER: 'demo', URL: 'http://a/?x=1' });
  });

  it('accepts = or : with spaces around the value, and an empty value', () => {
    expect(parseEnvFile('A: one\nB = two  \nC=\n')).toEqual({
      A: 'one',
      B: 'two',
      C: '',
    });
  });

  it('unquotes single quotes literally and double quotes with escapes', () => {
    expect(
      parseEnvFile(
        `A='lit \\n # $x'\nB="say \\"hi\\" \\\\ done"\nC="one\\ntwo"\nD="multi\nline"\n`,
      ),
    ).toEqual({
      A: 'lit \\n # $x',
      B: 'say "hi" \\ done',
      C: 'one\ntwo',
      D: 'multi\nline',
    });
  });

  it('ends an unquoted value at a comment preceded by a space, as compose does', () => {
    expect(
      parseEnvFile(
        'A=val # comment\nB=val# not a comment\nC= # only a comment\nD="v # kept" # comment\n',
      ),
    ).toEqual({ A: 'val', B: 'val# not a comment', C: '', D: 'v # kept' });
  });

  it('reads CRLF files', () => {
    expect(parseEnvFile('A=1\r\nB="2"\r\n')).toEqual({ A: '1', B: '2' });
  });

  it('refuses a line that is not a pair, naming the line', () => {
    expect(() => parseEnvFile('A=1\nnot a pair\n')).toThrow('line 2');
    expect(() => parseEnvFile("A='x' trailing\n")).toThrow('line 1');
  });

  it('refuses interpolation, which compose would expand and this reader does not', () => {
    expect(() => parseEnvFile('A=${B}\n')).toThrow('interpolation');
    expect(() => parseEnvFile('A="x $B"\n')).toThrow('interpolation');
  });
});

describe('loadInfraEnv', () => {
  const workspace = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'infra-'));
    for (const [name, text] of Object.entries(files))
      writeFileSync(join(root, name), text);
    return root;
  };
  const files = {
    '.env.example': 'DB_USER=demo\nDB_PORT=5432\n',
    '.env': 'DB_USER=local\nIGNORED=1\n',
  };

  it('takes the shell first, then .env, then .env.example, as compose does', () => {
    const root = workspace(files);

    expect(loadInfraEnv({ DB_USER: 'shell' }, root)).toEqual({
      DB_USER: 'shell',
      DB_PORT: '5432',
    });
    expect(loadInfraEnv({}, root)).toEqual({
      DB_USER: 'local',
      DB_PORT: '5432',
    });
    expect(
      loadInfraEnv({}, workspace({ '.env.example': files['.env.example'] })),
    ).toEqual({ DB_USER: 'demo', DB_PORT: '5432' });
  });

  it('falls through an empty value, like ${VAR:-default}', () => {
    expect(loadInfraEnv({ DB_USER: '' }, workspace(files))['DB_USER']).toBe(
      'local',
    );
  });

  it('names the file that cannot be read', () => {
    const root = workspace({ '.env.example': 'A=1\n', '.env': 'oops\n' });

    expect(() => loadInfraEnv({}, root)).toThrow('.env: line 1');
  });

  it('reads the repo defaults', () => {
    expect(loadInfraEnv({})['DB_USER']).toBe('demo');
  });
});

describe('what the dev scripts take from the infra env', () => {
  const infra = {
    DB_PORT: '5433',
    PGADMIN_PORT: '5051',
    DB_USER: 'dev user',
    DB_PASSWORD: 'p@ss/word',
  };

  it('lists the shared ports as numbers', () => {
    expect(sharedPorts(infra)).toEqual([5433, 5051]);
  });

  it('connects to the published loopback address, with the credentials escaped', () => {
    expect(databaseUrl(infra, 'demo_x')).toBe(
      'postgres://dev%20user:p%40ss%2Fword@127.0.0.1:5433/demo_x',
    );
  });
});

describe('.env.example and docker-compose.yml', () => {
  it('document the same defaults, in both directions', () => {
    const documented = loadInfraEnv({});
    const compose = readFileSync(
      join(import.meta.dir, '../../docker-compose.yml'),
      'utf8',
    );
    const used = [...compose.matchAll(/\$\{(\w+):-([^}]*)\}/g)].map(
      (m): [string, string] => [m[1] ?? '', m[2] ?? ''],
    );

    expect(new Set(used.map(([key]) => key))).toEqual(
      new Set(Object.keys(documented)),
    );
    for (const [key, value] of used)
      expect(value, key).toBe(documented[key] ?? '<undocumented>');
  });
});
