# 3. Vitest as the test runner

## Context

Nest 12 is ESM-only, which the Jest generator output could not run. `@nx/vitest` accepts vitest 3 or 4 and `@angular/build` accepts 4 or 5.

## Decision

vitest 4.x everywhere. The API uses `unplugin-swc` (decorator metadata). Angular projects use the `@angular/build:unit-test` builder, not Analog. Tooling under `tools/` uses `bun test`.

## Consequences

- Angular tests compile through the web app build target (`web:build:development`).
- A library without specs has no test target, because the builder fails on zero tests.
- Coverage thresholds live in each project's vitest config or Angular test target.
