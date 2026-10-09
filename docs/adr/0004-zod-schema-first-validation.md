# 4. Schema-first validation with Zod

## Context

Nest 12 ships `StandardSchemaValidationPipe`, `@Body({ schema })`, and Standard Schema support in `@nestjs/config` and `@nestjs/swagger`.

## Decision

Zod schemas validate request input (global `StandardSchemaValidationPipe`), the environment (`ConfigModule.forRoot({ validationSchema })`, failing at startup) and feed the OpenAPI document (`standardSchemaConverter` with `z.toJSONSchema`). No class-validator DTOs. Schemas live in delivery; use cases take plain typed commands.

## Consequences

- Types are inferred from schemas; there is one source of truth per contract.
- OpenAPI is served as JSON only, because the default CSP blocks Swagger UI's inline scripts.
