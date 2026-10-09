# 1. Rsbuild bundles the Nest API

## Context

`@nx/nest` generates webpack and its peer range stops at Nest 11. Nest 12 is ESM-only.

## Decision

The API is bundled with Rsbuild (`output.target: 'node'`, ESM, `source.decorators.version: 'legacy'`, node_modules external, `@anvil/*` bundled). Targets are inferred by `@nx/rsbuild`; no `@nx/nest` executors are used.

## Consequences

- No webpack dependency. Rsbuild's SWC emits decorator metadata; this is unverified at runtime because builds are run by the user.
- The Docker image runs `node dist/index.js` with production dependencies installed next to it.
