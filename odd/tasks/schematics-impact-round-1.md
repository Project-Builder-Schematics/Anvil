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
- 2026-10-08: S5, S7 and S8 done by one writer in 7 commits on `feat/workspace-scaffold` (753ad06 tasks, c0429c2, eae2898, 74a8746, 6470ca2, 3899a9b, and this record).

## Follow-ups

The review of 3d8c341..(the vscode settings commit) was approved and acknowledged (review-749c2a4d268e1e68). It left these advisory items:

- [x] S5 (74a8746): harden the generated error filter. Route: single writer, strict TDD.
  - RED: 6 `hex-route` filter tests, 1 `hex-slice` test, the `lib.test.ts` suite (missing `commandFields`) and the generated-files filter run in `compiles.test.ts` failed before the change; GREEN with `bun test schematics` 275 pass.
  - The filter catches only `<Slice>Error` (`hex-slice` writes the class), so global filters see every other exception. The status map is typed `Partial<Record<<Slice>ErrorCode, number>>` (a code no Answers cell cites is legitimate, so not exhaustive); an unmapped code is logged with `Logger` and answers 500; a re-run refreshes the map; every controller of the slice registers the filter.
  - Ordering's `OrderingErrorFilter` was regenerated (deleted, then `hex-subdomain`): only that file changed. `nx test api-ordering` green.
- [x] Minor (74a8746): the citation regex is a per-status parser, the command-field regex a top-level field reader, `errorStatuses` is flat, `.mcp.json` runs `./node_modules/.bin/ng`. "Old IMPACT rows were reflowed by prettier" is not fixed: prettier realigns the whole table when a row is wider than the rest.
- [x] S7 (c0429c2, eae2898): edit existing files through dialects. Route: single writer, strict TDD; trigger evidence: 25+ files across `schematics/`.
  - TypeScript and JavaScript files go through `@pbuilder/sdk/typescript`: `addImport` where it fits, `.modify` with `astLibrary` otherwise. No ts-morph dependency, no op pack. `writeBuffer` and the string and regex edits are gone.
  - One handle per path, checked against the real engine: a second `modify` on a path is `path-collision` even after an awaited read, and every read flushes all open handles. `startRun()` queues edits and applies them after the run's reads, one handle per path; a path the run created may still be edited once. `one-write-per-path.test.ts` now counts one `create` and one `modify` per path.
  - RED: `ts.test.ts` failed on the missing module, then 18 pass; the existing suite stayed green (249 pass) with its assertions on edited files reading prettier-formatted output.
  - HTML (`@angular/compiler`, splices over the original source) and CSS (postcss 8.5.29, now a devDependency) dialects under `schematics/_shared/dialects/`, 14 tests, round-trip byte-identical on every real template and stylesheet. No op: no schematic edits HTML or CSS. `defineDialect` is exported from no public subpath of the SDK, so it is imported by file.
  - Proof: ordering regenerated with the old and the new schematics in a scratch workspace gives identical files apart from import order and blank lines in the controller and barrel (and the S5 filter and error class); `web-context` output is identical; `hex-context --context=ordering` on the repo is "no changes" with the real engine.
- [x] S8 (6470ca2, 3899a9b): YAGNI cleanup of `schematics/` plus the ordering-ui "Schematics" follow-ups.
  - RED: 8 tests failed first (`type_import` values, type-name collision, extra colon in an input and an output); the outputs-only test passed at once (a coverage gap, not a defect).
  - Removed inputs: `kind`, `provider`, `driven_ports`, `use_case`, `status`, `kind` (ng-component), `layer`, `tactical`. Removed helpers: `sentence`, `className`, the unused `shared` parameters, three copies of the Subdomains parsing.
  - Kept, with no real use yet: the multi-subdomain layout and `subdomains`. Decision for the user.
- [x] S6 (fa851e4): `ng-service` emits `@Injectable({ providedIn: "root" })`. Angular 22 best practice is `@Service` for new singletons, confirmed via the angular-cli MCP `get_best_practices` and present in @angular/core 22.1.8. Fixed in the ordering UI slice: the factory emits `@Service()` (RED: 2 factory tests failed first), the design-system `ExperimentService` was regenerated, and the IMPACT row is recorded.

- [ ] S9: findings from the S5/S7/S8 reviews. Six slices, all approved and acknowledged on 2026-10-08:
  - review-6453b589801853e1
  - review-0a12e97a0c89d5ae
  - review-c7e10a99a380a3cd
  - review-b30e11999de4b644
  - review-e26b47248a8404c9
  - review-5a6032ed4946ee1b

  Fix these before slice 2 generates the inventory and payments filters:
  - The filter refresh keeps statuses that the docs no longer cite (hex-route:135-150).
  - A strict citation to a rule without a code is skipped silently (lib.ts:197-199).
  - `@Catch(OrderingError)` narrows the filter to `instanceof`. Confirm every refusal in domain and application throws `OrderingError`, not a bare `Error` or `RangeError`, or rejected requests return 500.
  - Rewriting a Nest import drops its modifiers (hex-route:302-305).
  - A missing barrel now fails `ng.ts` (96-98). Decide whether that is intended, and document it.
  - `defineDialect` is a deep import, because the SDK exports no public subpath (html.ts:5).
  - The `citedRules` defaults are hard to follow (lib.ts:176-186).
  - Minor: arrow depth in commandFields, the duplicated error-class name, the HTML splice edge cases, sibling-name validation in hex-use-case, an untested route-path error, and resolveSlice requiring a heading.

## Next step

S5, S7 and S8 are done. Slice 2 (`order-fulfilment-slice-2.md`) can generate its filter. Stryker on ordering: 100.00 (123 mutants, 0 survived). Last checks: `bun test schematics` 277 pass; `nx run-many -t lint test typecheck` green for 18 projects.
