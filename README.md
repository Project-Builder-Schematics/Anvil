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

1. Generate the libs with `@nx/js:library` (api, tags `scope:api,context:<ctx>,type:domain`, bundler none, vitest) and, for the web, `@nx/angular:library` for `feature`, `ui`, `data-access` plus `@nx/js:library` for `domain`.
2. Copy the skeleton from an existing context: `COD100.md`, `src/index.ts`, `src/composition.ts`, `domain/driven-ports`, `application`, `infrastructure`.
3. Add `<ctx>` to the `contexts` list in `eslint.config.mjs`.
4. Add `docs/<ctx>/README.md` and `glossary.md` (`**Term.** definition`).
5. When the lib gets its first spec, give it a `test` target (API libs get one from the generator; Angular libs copy the one in `libs/web/shared/design-system/project.json`).

## Several worktrees at once

Each git worktree gets its own ports, compose project and database, so any number of worktrees can run side by side. Identity is derived from the worktree path on every call; there is no state file.

|                         | Primary checkout   | Linked worktree        |
| ----------------------- | ------------------ | ---------------------- |
| Web / API / debug ports | 4200 / 3000 / 9229 | base + offset (2..199) |
| Compose project         | `demo`             | `demo-<slug>-<hash>`   |
| Database                | `demo`             | `demo_<slug>_<hash>`   |

One shared Postgres and pgadmin (project `demo`, network `demo-shared-net`) serve every worktree; each worktree runs only its own `api` container. Angular runs on the host and proxies `/api` to that worktree's API port.

```sh
bun run dev                 # shared infra, DB, api container, then the web dev server (Ctrl+C stops this worktree's api)
bun run dev --detach        # same, web server in the background (.dev/web.log)
bun run dev:status          # URLs, ports, compose project, DB name, running state
bun run dev:logs            # api compose logs plus the web log
bun run dev:stop            # stop web and api for this worktree only
bun run dev:seed            # re-run the seed on this worktree's DB
bun run dev --port-offset=N # override the derived offset (0-999)
```

A new worktree's database is created and seeded automatically the first time `dev` runs; an existing database is never re-seeded. `dev:seed` re-runs the seed on demand. There is no ORM or migration yet, so the seed currently only verifies the connection, and a new worktree starts with an empty database.
