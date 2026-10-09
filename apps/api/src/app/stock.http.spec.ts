import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, vi } from 'vitest';
import { configureApp } from './configure';

const ORIGIN = 'http://localhost:4200';
const env = {
  DB_HOST: 'db',
  DB_PORT: '5432',
  DB_NAME: 'anvil',
  DB_USER: 'anvil',
  DB_PASSWORD: 'secret',
  CORS_ORIGIN: ORIGIN,
};

describe('stock over HTTP', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { AppModule } = await import('./app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { corsOrigin: ORIGIN, openApi: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  const call = async (method: 'GET' | 'PUT', path: string, body?: unknown) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  };

  it('seeds the demo products, sets a level and reads it back', async () => {
    expect(await call('GET', '/stock/keyboard')).toEqual({
      status: 200,
      body: { productId: 'keyboard', onHand: 50, reserved: 0 },
    });
    const level = { productId: 'lamp', onHand: 7, reserved: 0 };
    expect(await call('PUT', '/stock/lamp', { onHand: 7 })).toEqual({
      status: 200,
      body: level,
    });
    expect(await call('GET', '/stock/lamp')).toEqual({
      status: 200,
      body: level,
    });
  });

  it('answers 404 for a product with no stock record', async () => {
    expect(await call('GET', '/stock/ghost')).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'PRODUCT_NOT_STOCKED' },
    });
  });

  it('answers 422 for a level that is not an integer of 0 or more', async () => {
    const expected = {
      status: 422,
      body: { statusCode: 422, code: 'STOCK_LEVEL_INVALID' },
    };
    expect(await call('PUT', '/stock/mouse', { onHand: -1 })).toEqual(expected);
    expect(await call('PUT', '/stock/mouse', { onHand: 1.5 })).toEqual(
      expected,
    );
  });

  it('answers 400 for a malformed body or a blank product id', async () => {
    expect((await call('PUT', '/stock/mouse', { onHand: '5' })).status).toBe(
      400,
    );
    expect((await call('PUT', '/stock/mouse', {})).status).toBe(400);
    expect((await call('GET', '/stock/%20')).status).toBe(400);
  });
});
