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
- [x] T3: `apps/web`, Angular 22, standalone, with routing. Route: delegated.
- [x] T4: Dockerfiles for api and web, plus `docker-compose.yml` with postgres. Route: delegated.
- [x] T5: DDD skeleton.
  - Context libs for api and web, plus shared-kernel.
  - Tags and module boundaries, and ring import rules.
  - `docs/<ctx>/` stubs.
  - A fitness test that fails on a forbidden import.
  - Route: delegated.
- [ ] T6: per-worktree Docker dev isolation, modeled on LCWebApp CORE-3655.
  1. Identity: `tools/dev/worktree.ts` (Bun), recomputed on every call, no state file. `git rev-parse --show-toplevel --git-dir --git-common-dir`; primary = git dir equals common dir, offset 0; linked worktree: `hash = sha256(toplevel).slice(0,6)`, `offset = 2 + parseInt(hash,16) % 198`; `--port-offset=N` (0-999) overrides; throw if a derived port equals a shared-infra port (5432, 5050). Ports: WEB 4200+off, API 3000+off, DEBUG 9229+off. slug = basename lowercased, non-[a-z0-9] to `_`, cut to 24. Compose project: `demo` or `demo-<slug>-<hash>`; DB name: `demo` or `demo_<slug>_<hash>`. Tested with bun test, RED first (primary vs linked, range, override validation, slug sanitizing).
  2. Compose: shared project `demo` holds `db` (postgres:17, healthcheck, volume) and `pgadmin`; the per-worktree project holds only `api`. All services join the external-by-name network `demo-shared-net` (`networks: shared: { name: demo-shared-net }`), db alias `db`. No container_name, no depends_on on api. api ports `${API_PORT:-3000}:3000` and `${DEBUG_PORT:-9229}:9229`, bind-mounts the worktree; env DB_HOST=db, DB_NAME=${DB_NAME:-demo}, CORS_ORIGIN. `web` only under `profiles: [prod]`; in dev Angular runs on the host.
  3. DB per worktree on the shared Postgres: after db is healthy, `CREATE DATABASE <name>` if missing, via `docker compose -p demo exec db psql`; do not disable migration validation. README notes a new worktree starts empty.
  4. Seed: the existence check result decides; only a just-created DB is seeded, an existing one never is. `tools/dev/seed.ts` (Bun) connects with the worktree DB name, currently verifies the connection and logs "no seed data yet", idempotent. `dev:seed` re-runs it. The "seed only when just created" decision is unit-tested in isolation, RED first, no real DB.
  5. Scripts (root package.json): `dev` (`bun tools/dev/dev.ts`, `--detach`), `dev:stop`, `dev:status`, `dev:logs`, `dev:seed`. Flow: ensure network and shared infra (`-p demo up -d db pgadmin`); wait for db health, ensure DB, seed if new; `-p <project> rm -sf api`; probe ports (on clash name them and suggest `--port-offset`); `-p <project> up -d --force-recreate api`; Angular dev server on WEB_PORT with proxy to API_PORT from env; Ctrl+C runs `compose stop api` for this project only. `--detach`: web server to `.dev/web.log`, `.dev/web.pid` holds pid plus start time (pid reuse guard), wait up to 30 s for the port, `.dev/` in .gitignore. `dev:stop`: SIGTERM to the process group, SIGKILL after 5 s, then `compose stop api`. `dev:status` prints web_url, api_url, debug_port, compose_project, db_name and running state. `dev:logs`: api compose logs plus tail of `.dev/web.log`. Docker failures say "Is Docker running?".
  6. Docs: README "Several worktrees at once" (also says a new worktree's DB is created and seeded automatically and `dev:seed` re-runs the seed); AGENTS.md: never assume localhost:4200/3000, read URLs from `bun run dev:status`, use `dev --detach` plus `dev:stop`, outside the scripts run `docker compose -p <project>`.
  Verification: bun tests for worktree.ts and the seed decision, lint, `dev:status` printing the identity without Docker.
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
- 2026-10-07: T3a decision (user): option (a), convert to the TS paths setup, which @nx/angular supports; NX_IGNORE_UNSUPPORTED_TS_SETUP is not used. Original error: `The "@nx/angular" plugin doesn't support the existing TypeScript setup. The Angular framework doesn't support a TypeScript setup with project references. See https://github.com/angular/angular/issues/37276`. Source check (`@nx/js` `isUsingTsSolutionSetup`): the solution setup is detected when package-manager workspaces exist, tsconfig.json extends the base with empty files/include, and the base sets `composite`. Conversion: removed the `@nx/js/typescript` plugin from nx.json, removed `workspaces` from package.json, deleted root tsconfig.json, rewrote tsconfig.base.json without composite/declarationMap/emitDeclarationOnly/customConditions and with `module: esnext`, `moduleResolution: bundler`, `noEmit`, empty `paths` (libs will add `@demo/*` entries), dropped references/outDir/rootDir/tsBuildInfoFile in the api tsconfigs. The api typecheck target now comes from the @nx/rsbuild plugin (`tsc -p tsconfig.app.json --noEmit`). The project graph name is now `@demo/api` (`nx show project api` still resolves). The `output.externals` regex is unchanged (`@demo/*` still bundled via tsconfig paths). Also includes `nx add @nx/angular@23.2.1` (package.json, bun.lock, .angular ignores). Checks: `bunx nx run-many -t lint test typecheck`: @demo/api typecheck, test, lint all passed. Commit 83d3c8c.
- 2026-10-07: T3 done. `@nx/angular:application` (web, esbuild bundler, standalone, routing, css, eslint, tags scope:web,type:app, no ssr, zoneless default). Installed Angular 22.1.8 (22.2.1 exists; generator pins 22.1). Test runner: `vitest-angular` (generator default; target `@angular/build:unit-test`, which compiles the specs in memory, no `nx build` run). Removed the generated NxWelcome component. Added `lib: [es2022, dom]` in apps/web/tsconfig.json (base has no dom). `bunx nx run-many -t lint test`: @demo/api and web lint/test all passed. No web typecheck target exists (no inference plugin); typechecking happens inside the Angular test/build. Commit c48e705.
- 2026-10-07: T4 done (files written, nothing built or started). `apps/api/Dockerfile`: bun build stage (`bun install --frozen-lockfile`, `bunx nx build api`), bun stage for `--production` deps from apps/api/package.json, runtime node:24-slim running `node dist/index.js` (Nest 12 is ESM-only and Rsbuild node target emits ESM with js at the dist root, per Rsbuild docs; Bun was not used at runtime because Nest-under-Bun is unverified). `apps/web/Dockerfile`: bun build stage (`bunx nx build web`), nginx:alpine with `apps/web/nginx.conf` SPA fallback, serving dist/apps/web/browser. `docker-compose.yml`: api, web, db (postgres:17, pg_isready healthcheck, named volume db-data). Per coordinator: no container_name, no top-level name, host ports from env with defaults (API_PORT 3000, WEB_PORT 4200, DB_PORT 5432). `.dockerignore` added. Check: `docker compose config -q`: parsed with no output (static validation only). Not verified (user rule): image builds, the api runtime start, and the dist output paths. Commit ce645e5.
- 2026-10-07: T5 done (commit recorded in the next progress line). Quality flags applied in tsconfig.base.json: noUncheckedIndexedAccess, noPropertyAccessFromIndexSignature, exactOptionalPropertyTypes (plus existing strict, noImplicitOverride, noFallthroughCasesInSwitch); the only break was `process.env.PORT` in apps/api/src/main.ts, fixed with `Number(process.env['PORT'] ?? 3000)`. Backend: `@nx/js:library` (bundler none, vitest) for catalog, inventory, ordering, payments, shipping, notifications (`libs/api/<ctx>`, `@demo/api-<ctx>`, tags scope:api, context:<ctx>, type:domain) and `libs/api/shared-kernel` (scope:api, context:shared, type:kernel). Each context has `COD100.md`, `src/index.ts` (`export {};`), `src/composition.ts` (one-line comment, exports nothing), and `.gitkeep` in `src/domain/driven-ports`, `src/application`, `src/infrastructure`. Frontend: only catalog and ordering, each with ui, feature, data-access (`@nx/angular:library`, OnPush, standalone, vitest-analog) and domain (`@nx/js:library`), tags scope:web, context:<ctx>, type:ui|feature|data-access|domain; generated sample code removed. PENDING frontend contexts: inventory, payments, shipping, notifications (16 libs). `docs/<ctx>/README.md` and `glossary.md` heading-only stubs for all six contexts. Empty libs use `passWithNoTests`. Module boundaries and the ring rule live in the root eslint.config.mjs (deviation: one `no-restricted-imports` block for `**/src/{domain,application}/**/*.ts` instead of one per lib config, so there is a single source). depConstraints: scope:api only api; scope:web only web (web cannot import api); context:<ctx> only itself and context:shared; domain only domain and kernel; ui only ui, domain, kernel; data-access only data-access, domain, kernel; feature and app may use all layers. Unrelated libs have not been tagged `context:shared` for web yet (T7). Fitness proof: temporary `libs/api/catalog/src/domain/offending.ts` importing `@nestjs/common`, `@demo/api-inventory` and `../../../inventory/src/composition`; `bunx nx lint api-catalog` FAILED with: (1) `'@nestjs/common' import is restricted from being used by a pattern. Frameworks belong in infrastructure` (no-restricted-imports); (2) `A project tagged with "context:catalog" can only depend on libs tagged with "context:catalog", "context:shared"` (@nx/enforce-module-boundaries); (3) `Projects cannot be imported by a relative or absolute path, and must begin with a npm scope`. The file was then removed. The proof is a manual run, not a persistent test. Checks: `bunx nx run-many -t lint test typecheck`: all 17 projects passed. Also: AGENTS.md "How to work" section added and CLAUDE.md now only points to AGENTS.md. Removed the template header comment in apps/api/src/main.ts.

## Next step

T6, then T7. After T7: T8 quality gates (pending from the coordinator) and the frontend contexts still pending from T5.
