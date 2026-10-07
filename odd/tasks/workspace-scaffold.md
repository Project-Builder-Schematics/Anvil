# Workspace scaffold: order management demo

## Objective

Set up an Nx monorepo with a NestJS API and an Angular 22 web app, using Bun and Docker. Both apps follow the DDD structure of LCWebApp's propylaea. The result is the base for a realistic application where repeatable processes can later be automated.

## Problem / why

A non-trivial domain is needed to exercise the "when to add a schematic" loop on real code. The domain is order management, with these bounded contexts: catalog, inventory, ordering, payments, shipping and notifications. This first step only sets up the stack and the DDD skeleton. Domain modeling is a separate, later step.

## Scope

In scope:
- Nx 23 workspace, with Bun as the package manager.
- `apps/api`: NestJS 12, bundled with Rsbuild (`output.target: 'node'`) instead of webpack, plus a Dockerfile.
- `apps/web`: Angular 22, plus a Dockerfile.
- `docker-compose.yml` with api, web and postgres.
- DDD skeleton, described in the constraints below.

Out of scope:
- Domain models, use cases and business rules. Those come with the later domain-modeling step.

## Constraints

- **Backend:** follows propylaea.
  - Each context is a lib `libs/api/<ctx>`. Each slice has `domain/` (with `driven-ports/`), `application/` (`make<UseCase>` factories), `infrastructure/` and a `composition.ts` that is the only wiring site.
  - The barrel `@demo/api-<ctx>` is the only public entry.
  - Also `libs/api/shared-kernel`.
  - Docs-first: `docs/<ctx>/` holds the glossary, domain model, flows and `.feature` files.
  - Rings are enforced: `domain/` and `application/` never import infrastructure, frameworks or other contexts' internals.
- **Frontend:** DDD per context in Nx, as `libs/web/<ctx>/{feature,ui,data-access,domain}`.
  - `feature` holds containers, `ui` holds presentational components, `data-access` holds state and API access.
- **Enforcement:** contexts and layers are tagged in Nx, with `@nx/enforce-module-boundaries`. The rings use `no-restricted-imports`.
- **Bun:** the package manager is Bun. It is also the Docker runtime base where the apps support it.
- **No builds:** builds are not run by the agent (user rule), so build verification is left to the user.

## TDD

Strict TDD mode is enabled in the user's global configuration.

The scaffold tasks are configuration, so they have no behavior to drive with RED/GREEN. Their checks are lint, typecheck and the generated tests.

TDD with observed RED applies from the first domain behavior onwards. The test runner is resolved in T1.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: generated files are excluded, and the authored config stays under about 400 lines.

## Tasks

- [x] T1: Nx 23 workspace with Bun, git initial commit. Route: delegated (multi-file writer).
- [x] T2: `apps/api`, NestJS 12 with Rsbuild in node target, legacy decorators with metadata, and a health endpoint. Route: delegated.
- [x] T3a: convert workspace to TS paths setup (prerequisite of T3; decision below). Route: delegated.
- [ ] T3: `apps/web`, Angular 22, standalone, with routing. Route: delegated.
- [ ] T4: Dockerfiles for api and web, plus `docker-compose.yml` with postgres. Route: delegated.
- [ ] T5: DDD skeleton.
  - Context libs for api and web, plus shared-kernel.
  - Tags and module boundaries, and ring import rules.
  - `docs/<ctx>/` stubs.
  - A fitness test that fails on a forbidden import.
  - Route: delegated.
- [ ] T6: per-worktree Docker dev isolation (design pending, inspired by LCWebApp CORE-3655-worktree-dev)
- [ ] T7: design system from awesome-design-md themes with theme- and component-level A/B testing

## Acceptance criteria

- `bun install` works.
- `nx lint` and `nx test` pass for all projects.
- A deliberate cross-context deep import is rejected by lint.
- The api project's build target uses Rsbuild, not webpack.
- Both Dockerfiles and the compose file exist and reference the Bun-based install.

## Progress

- 2026-10-07: document created. The domain chosen is order management. The frontend approach chosen is DDD per context in Nx.
- 2026-10-07: T1 done, commit 77a7599. `bun install`: 307 packages installed. `bunx nx --version`: local v23.2.1 (template pinned 23.2.0, bumped). `bunx nx show projects`: empty. Scope `@demo`, workspaces `apps/*` and `libs/*/*`. Dropped the template's non-Claude agent config dirs (.cursor, .gemini, .opencode, .codex, .github, opencode.json). Test runner is whatever each generator picks (recorded in T2/T3).
- 2026-10-07: T2 done, commit 17376b2. Generated with @nx/nest:application (webpack default), then switched to Rsbuild: removed webpack.config.js, @nx/webpack plugin and webpack deps; added @nx/rsbuild 23.2.1 via `@nx/rsbuild:configuration --target=node`. Rsbuild config: `source.decorators.version: legacy`, node_modules externalized (regex keeps `@demo/*` bundled). Nest 12.1.2 is ESM-only, so the api is `type: module` and the jest generator output (CJS-style) failed with an ESM syntax error; replaced with vitest 4.1.11 + unplugin-swc (the runner recommended in Nest docs, needed for decorator metadata). Test runner for api: vitest. Replaced the generated AppController/AppService with HealthController (GET /api/health returning `{status:ok}`; global prefix `api` is set in main.ts).
  - RED: `bunx nx test api` with the spec written and no implementation: FAIL, `Cannot find module ./health.controller`. (An earlier jest attempt failed for ESM syntax reasons and is not counted as RED.)
  - GREEN: `bunx nx test api`: 1 file, 1 test passed.
  - `bunx nx run-many -t lint test typecheck`: all 3 api tasks succeeded.
  - `bunx nx show project api --json`: build target command is `rsbuild build` (technology rsbuild); no webpack reference remains outside this document and bun.lock.
  - Not verified (user rule, no builds): that `rsbuild build` bundles and the output runs. The `/api/health` route is covered only by the controller unit test.
- 2026-10-07: T3 BLOCKED. `bunx nx add @nx/angular@23.2.1` fails in `@nx/angular:init`: `The "@nx/angular" plugin doesn't support the existing TypeScript setup. The Angular framework doesn't support a TypeScript setup with project references. See https://github.com/angular/angular/issues/37276`. Cause: the Nx 23 template uses TS project references (`@nx/js/typescript` plugin, composite tsconfigs). Escape hatch named by Nx: env `NX_IGNORE_UNSUPPORTED_TS_SETUP=true` (at own risk). Not applied; the package.json and bun.lock changes from the failed `nx add` were reverted. T3 to T7 not started. T6 and T7 depend on a working Angular app, so they are blocked as well.
- 2026-10-07: T3a decision (user): option (a), convert to the TS paths setup, which @nx/angular supports; NX_IGNORE_UNSUPPORTED_TS_SETUP is not used. Original error: `The "@nx/angular" plugin doesn't support the existing TypeScript setup. The Angular framework doesn't support a TypeScript setup with project references. See https://github.com/angular/angular/issues/37276`. Source check (`@nx/js` `isUsingTsSolutionSetup`): the solution setup is detected when package-manager workspaces exist, tsconfig.json extends the base with empty files/include, and the base sets `composite`. Conversion: removed the `@nx/js/typescript` plugin from nx.json, removed `workspaces` from package.json, deleted root tsconfig.json, rewrote tsconfig.base.json without composite/declarationMap/emitDeclarationOnly/customConditions and with `module: esnext`, `moduleResolution: bundler`, `noEmit`, empty `paths` (libs will add `@demo/*` entries), dropped references/outDir/rootDir/tsBuildInfoFile in the api tsconfigs. The api typecheck target now comes from the @nx/rsbuild plugin (`tsc -p tsconfig.app.json --noEmit`). The project graph name is now `@demo/api` (`nx show project api` still resolves). The `output.externals` regex is unchanged (`@demo/*` still bundled via tsconfig paths). Also includes `nx add @nx/angular@23.2.1` (package.json, bun.lock, .angular ignores). Checks: `bunx nx run-many -t lint test typecheck`: @demo/api typecheck, test, lint all passed. Commit: see the next progress line.

## Next step

Decision needed on how to unblock T3: (a) convert the workspace to the TS paths setup (no project references; Nx-supported for Angular, touches the api tsconfigs and the typecheck target), or (b) set NX_IGNORE_UNSUPPORTED_TS_SETUP=true and accept the risk.
