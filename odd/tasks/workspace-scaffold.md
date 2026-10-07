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

- [ ] T1: Nx 23 workspace with Bun, git initial commit. Route: delegated (multi-file writer).
- [ ] T2: `apps/api`, NestJS 12 with Rsbuild in node target, legacy decorators with metadata, and a health endpoint. Route: delegated.
- [ ] T3: `apps/web`, Angular 22, standalone, with routing. Route: delegated.
- [ ] T4: Dockerfiles for api and web, plus `docker-compose.yml` with postgres. Route: delegated.
- [ ] T5: DDD skeleton.
  - Context libs for api and web, plus shared-kernel.
  - Tags and module boundaries, and ring import rules.
  - `docs/<ctx>/` stubs.
  - A fitness test that fails on a forbidden import.
  - Route: delegated.
- [ ] T6: per-worktree Docker dev isolation (design pending, inspired by LCWebApp CORE-3655-worktree-dev)

## Acceptance criteria

- `bun install` works.
- `nx lint` and `nx test` pass for all projects.
- A deliberate cross-context deep import is rejected by lint.
- The api project's build target uses Rsbuild, not webpack.
- Both Dockerfiles and the compose file exist and reference the Bun-based install.

## Progress

- 2026-10-07: document created. The domain chosen is order management. The frontend approach chosen is DDD per context in Nx.

## Next step

T1.
