import { envSchema } from './config';

const valid = {
  DB_HOST: 'db',
  DB_PORT: '5432',
  DB_NAME: 'demo',
  DB_USER: 'demo',
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

  it('rejects a CORS origin that is not a URL', () => {
    expect(() => envSchema.parse({ ...valid, CORS_ORIGIN: 'nope' })).toThrow(
      'CORS_ORIGIN',
    );
  });
});
