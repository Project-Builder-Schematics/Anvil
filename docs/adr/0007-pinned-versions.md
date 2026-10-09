# 7. Pinned versions

## Context

npm latest is not always the compatible set.

## Decision

TypeScript 6.0.x, vitest 4.x, Nx 23.2.1, Angular 22.1.x, Nest 12.1.x, Rsbuild 2.2.x, Zod 4.x. Nx runs under Node; Bun is the package manager. `@nx/nest` peers Nest <12, so its executors are not used.

## Consequences

- Upgrades are deliberate: bump the set and re-run lint, typecheck and test.
