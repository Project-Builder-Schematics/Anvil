# Demo

Order management demo: an Nx monorepo with a NestJS API (`apps/api`) and an Angular web app (`apps/web`), Bun as package manager.

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
