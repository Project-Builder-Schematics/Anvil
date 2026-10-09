import { envSchema } from './config';

const valid = {
  DB_HOST: 'db',
  DB_PORT: '5432',
  DB_NAME: 'anvil',
  DB_USER: 'anvil',
  DB_PASSWORD: 'secret',
  CORS_ORIGIN: 'http://localhost:4200',
};

describe('envSchema', () => {
  it('applies defaults and coerces numbers', () => {
    expect(envSchema.parse(valid)).toMatchObject({ PORT: 3000, DB_PORT: 5432 });
  });

  it.each(Object.keys(valid))('rejects a missing %s', (key) => {
    const rest = Object.fromEntries(
      Object.entries(valid).filter(([name]) => name !== key),
    );
    expect(() => envSchema.parse(rest)).toThrow(key);
  });

  it.each([
    'nope',
    'ftp://localhost:4200',
    'http://localhost:4200/',
    'http://localhost:4200/app',
    'http://localhost:4200?x=1',
    'http://user@localhost:4200',
  ])('rejects %p as a CORS origin', (origin) => {
    expect(() => envSchema.parse({ ...valid, CORS_ORIGIN: origin })).toThrow(
      'CORS_ORIGIN',
    );
  });

  it.each([
    'http://localhost:4200',
    'https://app.example.com',
    'http://127.0.0.1:3000',
  ])('accepts %p as a CORS origin', (origin) => {
    expect(envSchema.parse({ ...valid, CORS_ORIGIN: origin }).CORS_ORIGIN).toBe(
      origin,
    );
  });

  it.each(['prod', 'Production', 'staging', ''])(
    'rejects %p as NODE_ENV, so a typo cannot switch OpenAPI on in production',
    (value) => {
      expect(() => envSchema.parse({ ...valid, NODE_ENV: value })).toThrow(
        'NODE_ENV',
      );
    },
  );

  it.each(['development', 'test', 'production'])(
    'accepts %p as NODE_ENV',
    (value) => {
      expect(envSchema.parse({ ...valid, NODE_ENV: value }).NODE_ENV).toBe(
        value,
      );
    },
  );

  it('defaults NODE_ENV to development', () => {
    expect(envSchema.parse(valid).NODE_ENV).toBe('development');
    expect(envSchema.parse({ ...valid, NODE_ENV: 'production' }).NODE_ENV).toBe(
      'production',
    );
  });
});
