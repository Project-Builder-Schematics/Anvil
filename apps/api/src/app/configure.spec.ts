import {
  Body,
  Controller,
  Module,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { configureApp } from './configure';
import { HealthController } from './health.controller';

const echoSchema = z.object({ name: z.string().min(1) });

@Controller('echo')
class EchoController {
  @Post()
  echo(@Body({ schema: echoSchema }) body: z.infer<typeof echoSchema>) {
    return body;
  }
}

@Module({ controllers: [HealthController, EchoController] })
class TestModule {}

describe('configureApp', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { corsOrigin: 'http://localhost:4200' });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
  });

  afterAll(() => app.close());

  it('serves the health endpoint under the api prefix with security headers', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('allows the configured CORS origin only', async () => {
    const allowed = await fetch(`${base}/api/health`, {
      headers: { origin: 'http://localhost:4200' },
    });
    const other = await fetch(`${base}/api/health`, {
      headers: { origin: 'http://evil.example' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:4200',
    );
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('validates bodies against the Zod schema', async () => {
    const post = (body: unknown) =>
      fetch(`${base}/api/echo`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:4200',
        },
        body: JSON.stringify(body),
      });
    expect((await post({ name: '' })).status).toBe(400);
    const ok = await post({ name: 'a' });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ name: 'a' });
  });

  it('publishes the schema in the OpenAPI document', async () => {
    const document = (await (await fetch(`${base}/api/docs-json`)).json()) as {
      paths: Record<string, unknown>;
    };
    expect(JSON.stringify(document.paths['/api/echo'])).toContain('"name"');
  });
});
