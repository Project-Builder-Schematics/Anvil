import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, vi } from 'vitest';
import { configureApp } from './configure';

const ORIGIN = 'http://localhost:4200';
const env = {
  DB_HOST: 'db',
  DB_PORT: '5432',
  DB_NAME: 'demo',
  DB_USER: 'demo',
  DB_PASSWORD: 'secret',
  CORS_ORIGIN: ORIGIN,
};

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

describe('orders over HTTP', () => {
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

  const call = async (
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<Reply> => {
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

  const newOrder = async (): Promise<string> => {
    const { body } = await call('POST', '/orders');
    return body['orderId'] as string;
  };

  it('runs the lifecycle: create, add a line, get, place, cancel', async () => {
    const created = await call('POST', '/orders');
    expect(created.status).toBe(201);
    const orderId = created.body['orderId'] as string;
    expect(orderId).toEqual(expect.any(String));

    const line = { productId: 'keyboard', quantity: 2 };
    const added = await call('POST', `/orders/${orderId}/lines`, line);
    const view = {
      orderId,
      status: 'Draft',
      lines: [
        {
          productId: 'keyboard',
          quantity: 2,
          unitPrice: { amount: 4500, currency: 'USD' },
        },
      ],
    };
    expect(added).toEqual({ status: 200, body: view });
    expect(await call('GET', `/orders/${orderId}`)).toEqual({
      status: 200,
      body: view,
    });

    expect(await call('POST', `/orders/${orderId}/place`)).toEqual({
      status: 200,
      body: { orderId, status: 'Placed' },
    });
    expect(await call('POST', `/orders/${orderId}/cancel`)).toEqual({
      status: 200,
      body: { orderId, status: 'Cancelled' },
    });
  });

  it('answers 404 for an order that does not exist', async () => {
    const reply = await call('GET', '/orders/nope');
    expect(reply).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'ORDER_NOT_FOUND' },
    });
    expect((await call('POST', '/orders/nope/place')).status).toBe(404);
    expect((await call('POST', '/orders/nope/cancel')).status).toBe(404);
  });

  it('answers 422 for a refused value', async () => {
    const orderId = await newOrder();
    const add = (productId: string, quantity: number) =>
      call('POST', `/orders/${orderId}/lines`, { productId, quantity });
    expect((await add('keyboard', 100)).body['code']).toBe(
      'QUANTITY_OUT_OF_RANGE',
    );
    expect((await add('keyboard', 1.5)).status).toBe(422);
    expect(await add('ghost', 1)).toEqual({
      status: 422,
      body: { statusCode: 422, code: 'PRODUCT_NOT_FOUND' },
    });
    expect(await call('POST', `/orders/${orderId}/place`)).toEqual({
      status: 422,
      body: { statusCode: 422, code: 'ORDER_EMPTY' },
    });
  });

  it('answers 409 for a refused state', async () => {
    const orderId = await newOrder();
    await call('POST', `/orders/${orderId}/lines`, {
      productId: 'mouse',
      quantity: 1,
    });
    await call('POST', `/orders/${orderId}/place`);
    expect(
      await call('POST', `/orders/${orderId}/lines`, {
        productId: 'mouse',
        quantity: 1,
      }),
    ).toEqual({
      status: 409,
      body: { statusCode: 409, code: 'ORDER_NOT_EDITABLE' },
    });
    expect((await call('POST', `/orders/${orderId}/place`)).status).toBe(409);
    await call('POST', `/orders/${orderId}/cancel`);
    expect(await call('POST', `/orders/${orderId}/cancel`)).toEqual({
      status: 409,
      body: { statusCode: 409, code: 'ORDER_NOT_CANCELLABLE' },
    });
  });

  it('answers 400 for a malformed body', async () => {
    const orderId = await newOrder();
    const add = (body: unknown) =>
      call('POST', `/orders/${orderId}/lines`, body);
    expect((await add({ productId: 'keyboard', quantity: '2' })).status).toBe(
      400,
    );
    expect((await add({ productId: '  ', quantity: 1 })).status).toBe(400);
    expect((await add({ quantity: 1 })).status).toBe(400);
    expect((await add({ productId: 'keyboard' })).status).toBe(400);
  });

  it('ignores a customer or actor id in the body', async () => {
    const orderId = await newOrder();
    const reply = await call('POST', `/orders/${orderId}/lines`, {
      productId: 'keyboard',
      quantity: 1,
      customerId: 'c-1',
      actorId: 'a-1',
    });
    expect(reply.status).toBe(200);
    expect(JSON.stringify(reply.body)).not.toContain('c-1');
  });
});
