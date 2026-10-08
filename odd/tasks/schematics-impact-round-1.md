# Schematics: IMPACT round 1

## Objective

Fix the four schematic gaps that the first real use (the ordering first slice) recorded in `schematics/IMPACT.md`. Then prove each fix by regenerating ordering's affected pieces, replacing the hand-written workarounds.

## Problem / why

`IMPACT.md` (2026-10-08) records 1 miss and 4 defects from the ordering slice. Each one is either code hand-written around a schematic, or a defect the next context will hit. This round closes the "when to improve a schematic" loop with evidence.

## Scope

| #   | Gap                                                                                                                                        | IMPACT row | Fix                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `hex-route` has no error-to-status mapping, so `OrderingErrorFilter` was hand-written.                                                     | miss       | `hex-route` (or `hex-slice`) generates the context's error filter from the Driving adapters `Answers` column and the error codes, and registers it. |
| S2  | `hex-route` emits `z.object({})` for a body-less POST, which rejects a missing body.                                                       | defect     | Emit `.default({})`, or omit the body schema, for routes with no body.                                                                              |
| S3  | `hex-bounded-context` leaves the README without a `## Subdomains` table, so `hex-subdomain` refuses to run. All six contexts are affected. | defect     | The schematic writes the table. Backfill the five other READMEs by hand, since docs are human-owned; ordering already has its table.                |
| S4  | The generated pending steps return `skipped`, so the scenarios report passed at 0% coverage.                                               | defect     | Pending steps fail loudly with "step not implemented: <phrase>", so a new use case is RED until it is implemented.                                  |

The IMPACT row for the missing tsconfig paths in the api vitest config is already fixed (26f44ed) and is out of scope.

## Constraints

- Strict TDD for every schematic change: factory test first, then an observed RED, then GREEN. Keep the drift test, the skill and the AGENTS.md table in sync.
- Prove the fixes on ordering:
  - Regenerate, or re-run, the affected schematic.
  - The hand-written `OrderingErrorFilter` and the `.default({})` edit are replaced by generated equivalents.
  - The ordering tests and Stryker stay green.
  - A `use` row goes to IMPACT.md.
- Re-runs stay idempotent (T14).
- No builds or boots.

## Tasks

- [x] S1: generated error filter. Ordering switches to it. Route: delegated writer. Commit f21a632. RED: 7 hex-route tests failed before the change; GREEN with `bun test schematics` 241 pass. Ordering: hand-written filter and spec deleted, `hex-subdomain` re-run, HTTP spec unchanged and green.
- [x] S2: body-less routes (`.default({})` when every command field is a path param). Route: delegated writer. Commit f960d62. RED: 2 tests failed first. Ordering: controller regenerated, diff empty against the hand-edited one.
- [x] S3: Subdomains table, plus the backfill. Route: delegated writer. Commit dbb1e37. RED: 2 tests failed first. `hex-context --context=catalog` ran on the backfilled README (throwaway reverted).
- [x] S4: failing pending steps. Route: delegated writer. Commit f74ae64. RED: 4 tests failed first. Throwaway `ArchiveOrder` made `nx test api-ordering` fail (1 failed, 99 passed), reverted.

## Acceptance criteria

- `bun test schematics` is green.
- `nx run-many -t lint test typecheck` is green.
- Ordering has no hand-written filter or body workaround left.
- Ordering's Stryker score is 90 or higher.
- The IMPACT rows are updated.

## Progress

- 2026-10-08: document created. The user approved doing the improvements, then the next slice.
- 2026-10-08: S1 to S4 done, each with its IMPACT row.

## Follow-ups

The review of 3d8c341..(the vscode settings commit) was approved and acknowledged (review-749c2a4d268e1e68). It left these advisory items:

- [ ] S5: harden the generated error filter.
  - The status map is not regenerated on a re-run after a docs change, so it goes stale (hex-route:265-271).
  - The filter is applied only to the first controller.
  - The catch-all `@Catch()` preempts global filters (OrderingErrorFilter.ts:22).
  - An unmapped domain error becomes a silent 500. It should be logged.
  - The status map is untyped, so exhaustiveness over the error codes is lost (OrderingErrorFilter.ts:5).
  - The generated filter has no behavioural test.
- [ ] Minor:
  - The Answers and command-field regexes are greedy or narrow (lib.ts:224-226, hex-route:219).
  - errorStatuses nesting (lib.ts:219-250).
  - Old IMPACT rows were reflowed by prettier.
  - `.mcp.json` runs `bunx ng`; pin it to the local binary.
- [x] S6 (fa851e4): `ng-service` emits `@Injectable({ providedIn: "root" })`. Angular 22 best practice is `@Service` for new singletons, confirmed via the angular-cli MCP `get_best_practices` and present in @angular/core 22.1.8. Fixed in the ordering UI slice: the factory emits `@Service()` (RED: 2 factory tests failed first), the design-system `ExperimentService` was regenerated, and the IMPACT row is recorded.

## Next step

S6 lands with the ordering UI slice. S5 comes before the next context generates a filter, which is slice 2. Stryker on ordering: 100.00 (123 mutants, 0 survived). Last checks: `bun test schematics` 246 pass; `nx run-many -t lint test typecheck` green for 18 projects.
