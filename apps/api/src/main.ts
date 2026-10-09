import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure';
import type { Env } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
    routeConflictPolicy: { duplicate: 'error', shadow: 'warn' },
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  configureApp(app, {
    corsOrigin: config.get('CORS_ORIGIN', { infer: true }),
    openApi: config.get('NODE_ENV', { infer: true }) !== 'production',
  });
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
