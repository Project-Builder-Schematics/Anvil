# 2. TypeScript paths instead of project references

## Context

The Nx 23 template uses TS project references (`@nx/js/typescript`). `@nx/angular` refuses that setup.

## Decision

`tsconfig.base.json` with `paths` for `@demo/*`, no composite, no package-manager workspaces. `NX_IGNORE_UNSUPPORTED_TS_SETUP` is not used.

## Consequences

- Libraries resolve through paths; typecheck is `tsc --noEmit` per project.
- Every new library adds a path entry (the generators do it).
- TypeScript stays on 6.0.x: `@angular/build` requires >=6.0 <6.1 and typescript-eslint peers <6.1.
