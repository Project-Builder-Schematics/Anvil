import {
  StandardSchemaValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { z } from 'zod';

export function configureApp(
  app: INestApplication,
  options: { corsOrigin: string },
): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useSecurityHeaders();
  app.enableCors({ origin: [options.corsOrigin] });
  app.enableCsrfProtection({ trustedOrigins: [options.corsOrigin] });
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Demo API').build(),
    {
      standardSchemaConverter: (schema, { schemaType }) => ({
        schema: z.toJSONSchema(schema as z.ZodType, { io: schemaType }),
      }),
    },
  );
  // JSON only: the Swagger UI needs inline scripts that the default CSP blocks.
  SwaggerModule.setup('docs', app, document, {
    ui: false,
    raw: ['json'],
    useGlobalPrefix: true,
  });
}
