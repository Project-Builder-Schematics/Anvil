import { Test } from '@nestjs/testing';
import { afterEach, vi } from 'vitest';

const valid = {
  DB_HOST: 'db',
  DB_PORT: '5432',
  DB_NAME: 'anvil',
  DB_USER: 'anvil',
  DB_PASSWORD: 'secret',
  CORS_ORIGIN: 'http://localhost:4200',
};

// Nest bootstraps AppModule the same way, so a rejected compile is a failed start.
async function bootstrap(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { AppModule } = await import('./app.module');
  return Test.createTestingModule({ imports: [AppModule] }).compile();
}

describe('AppModule environment validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts with a valid environment', async () => {
    const moduleRef = await bootstrap(valid);
    await moduleRef.close();
  });

  it('fails to start when a required variable is missing', async () => {
    await expect(bootstrap({ ...valid, DB_HOST: '' })).rejects.toThrow(
      'DB_HOST',
    );
  });

  it('fails to start on a NODE_ENV typo such as prod', async () => {
    await expect(bootstrap({ ...valid, NODE_ENV: 'prod' })).rejects.toThrow(
      'NODE_ENV',
    );
  });

  it('fails to start when CORS_ORIGIN is not an origin', async () => {
    await expect(
      bootstrap({ ...valid, CORS_ORIGIN: 'http://localhost:4200/app' }),
    ).rejects.toThrow('CORS_ORIGIN');
  });
});
