# 5. One database per worktree

## Context

Several git worktrees must run their dev stacks at the same time without colliding.

## Decision

One shared Postgres and pgadmin (compose project `demo`). Each worktree runs only its own `api` container in project `demo-<slug>-<hash>`, uses ports offset by a hash of its path, and gets its own database, created and seeded on first `dev`. Identity is recomputed from git on every call.

## Consequences

- A new worktree starts with an empty database; seeds run only for a database created in that run.
- Docker is required for `dev`; `dev:status` works without it.
