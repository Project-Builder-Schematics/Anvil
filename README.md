# Demo

Order management demo: an Nx monorepo with a NestJS API and an Angular web app, organised as bounded contexts (catalog, inventory, ordering, payments, shipping, notifications). Domain modelling comes later; this repo is the stack and the skeleton.

## Stack

| Area      | Choice                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Workspace | Nx 23, Bun as package manager, Nx run under Node                                                                        |
| API       | NestJS 12, bundled with Rsbuild, Zod validation, OpenAPI JSON                                                           |
| Web       | Angular 22, zoneless, standalone, signals, esbuild application builder                                                  |
| Tests     | vitest 4 (Angular unit-test builder for web), `bun test` for `tools/`, coverage thresholds, Stryker for API domain code |
| Quality   | typescript-eslint strictTypeChecked, Nx module boundaries, Prettier, commitlint, lefthook                               |
| Runtime   | Docker (Postgres 17, pgadmin, api, nginx for web)                                                                       |

## Prerequisites

Bun, Node 24 or newer, Docker. Then `bun install`, and once per clone or worktree `bunx lefthook install` to enable the git hooks (pre-commit runs `nx affected -t lint typecheck`, commit-msg runs commitlint).

## Commands

```sh
bunx nx run-many -t lint test typecheck   # everything
bunx nx affected -t lint typecheck test   # what changed
bunx nx format:check                      # Prettier (format:write fixes)
bun run check:tools                       # lint, typecheck and test tools/
bun run check:schematics                  # lint, typecheck and test schematics/
bun run design:themes                     # regenerate theme CSS from themes/
bun run mutation                          # Stryker on libs/api/*/src/{domain,application}
bun run dev                               # local stack, see the worktree section below
```

Builds are not part of these commands; CI does not build yet. Add `build` to the CI target list when you want it.

## Architecture map

```
apps/api              NestJS delivery (controllers, config, OpenAPI)
apps/web              Angular shell
libs/api/<ctx>        one bounded context: src/domain (+driven-ports), src/application, src/infrastructure, src/composition.ts
libs/api/shared-kernel
libs/web/<ctx>/{feature,ui,data-access,domain}   catalog and ordering so far
libs/web/shared/design-system
docs/<ctx>            glossary, model, flows per context
docs/adr              decisions
tools/                dev stack, theme generator
```

Tags: `scope:api|web`, `context:<ctx>|shared`, `type:app|feature|ui|data-access|domain|kernel`. Enforced by `@nx/enforce-module-boundaries`: a context depends only on itself and `context:shared`; api and web never import each other; `domain` depends on `domain` and `kernel`; `ui` never depends on `data-access` or `feature`. Rings: `domain/` and `application/` never import `@nestjs/*`, `typeorm`, `pg`, `knex` or `infrastructure/`.

Backend rules: use cases are plain TypeScript factories wired only in `composition.ts`; ports are injected with explicit `Symbol` tokens, never type-based DI; Zod schemas live in delivery.

## Add a context

Libs, components, services, directives, controllers and providers come from Project Builder schematics, not from Nx, Angular or Nest generators; see "Schematics" in `AGENTS.md` for the schematic per situation and the `BUILDER_*` environment gotcha.

1. `hex-bounded-context` creates the API lib (`libs/api/<ctx>`, alias, tags, lint registration, Nest module) and the docs skeleton (`docs/<ctx>/`).
2. Fill in `docs/<ctx>/domain-model.md` and write a `.feature` per use case; the generators read them and never invent contracts.
3. `hex-subdomain` (or `hex-context`) generates the slice, driven ports, use cases and Nest controllers from those tables.
4. `web-context` creates `libs/web/<ctx>/{feature,ui,data-access,domain}`; `ng-component`, `ng-service` and `ng-directive` fill them.
5. Run `bunx prettier --write` on the files an `execute` lists, and log the use in `schematics/IMPACT.md`.

## Several worktrees at once

Each git worktree gets its own ports, compose project and database, so any number of worktrees can run side by side. Identity is derived from the worktree path on every call; there is no state file.

|                         | Primary checkout   | Linked worktree        |
| ----------------------- | ------------------ | ---------------------- |
| Web / API / debug ports | 4200 / 3000 / 9229 | base + offset (2..199) |
| Compose project         | `demo`             | `demo-<slug>-<hash>`   |
| Database                | `demo`             | `demo_<slug>_<hash>`   |

One shared Postgres and pgadmin (project `demo`, network `demo-shared-net`) serve every worktree; each worktree runs only its own `api` container. Angular runs on the host and proxies `/api` to that worktree's API port.

Published ports are bound to `127.0.0.1`. The shared-infra ports and credentials default to the values in `.env.example`; copy it to `.env` to override them (`.env` is git-ignored). The api container installs its own `node_modules` into a volume and starts Bun with `--inspect=0.0.0.0:9229` (a loopback bind would refuse the host through Docker's published port; the unauthenticated inspector is reachable only from `127.0.0.1` on the host and from the containers on `demo-shared-net`); open the `https://debug.bun.sh/#127.0.0.1:<debug_port>/...` URL that `bun run dev:logs` prints.

```sh
bun run dev                 # shared infra, DB, api container, then the web dev server (Ctrl+C stops this worktree's api)
bun run dev --detach        # same, web server in the background (.dev/web.log)
bun run dev:status          # URLs, ports, compose project, DB name, running state
bun run dev:logs            # api compose logs plus the web log
bun run dev:stop            # stop web and api for this worktree only
bun run dev:seed            # re-run the seed on this worktree's DB
bun run dev --port-offset=N # override the derived offset (0-999)
```

A new worktree's database is created and seeded automatically the first time `dev` runs; an existing database is never re-seeded, and a failed seed drops the new database so the next run seeds it again. `dev:seed` re-runs the seed on demand (statements must be upserts) and retries transient connection errors. Exit codes follow the web server's. There is no ORM or migration yet, so the seed currently only verifies the connection, and a new worktree starts with an empty database.
