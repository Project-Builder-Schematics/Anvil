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
- 2026-10-08: S9 and S10 done by one writer in 6 commits (84cc480, f7970fb, db0b468, 90e5ba9, ad5afe6, aba8bd6).

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

- [x] S9 (84cc480, f7970fb): findings from the S5/S7/S8 reviews. Six slices, all approved and acknowledged on 2026-10-08:
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

  Done (route: single writer, strict TDD; trigger evidence: 25+ files across `schematics/`):
  - RED, first run of each new test: `lib.test.ts` 2 failed (a citation of a rule with no code, a reversed range) and 1 failed (the arrow of a function type in `commandFields`); `hex-route` 2 failed (a stale status kept, the `type` and alias of a Nest import dropped); `ng.test.ts` 1 failed (a missing barrel gave the engine's "does not exist" message); `resolveSlice` 1 failed (the README does not list the slice); `hex-use-case` 1 failed (a README subdomain name that is not dash-case). The untested hex-subdomain route-path error and the new ordering HTTP cases passed at once, so they are coverage gaps, not defects.
  - Status map: a re-run now drops the codes the docs no longer cite. A strict citation of a rule with no code refuses ("422 cites rule 5, which names no error code"), and so does a reversed range or an unreadable list; `citedRules` is one regex per part instead of the defaulted destructuring.
  - Nest imports: `sortNamedImports` (`_shared/ts.ts`) re-adds the structures of the named imports, so alias and `type` survive.
  - Missing barrel: intended, since `web-context` and `web-shared-lib` always write one. `registerInLib` now refuses with "src/index.ts not found — create the lib first" and writes nothing (test).
  - Ordering refusals: every refusal in domain and application throws `OrderingError`; none throws a bare `Error` or `RangeError`, so there is no 500 bug. The only `RangeError`s are in `Money`, `OrderId` and `ProductId`.
  - Decision: those `RangeError`s are internal invariants, not user-facing refusals. The docs already say a `Money` violation is a bug of the adapter, and the zod schemas at the HTTP edge (`z.string().trim().min(1)`) refuse a blank id with 400 before a value object sees it, so a 500 there is the right answer to a real bug. Mapping them to 4xx would hide an adapter bug behind a client error. New HTTP cases: add a line to an unknown order (404), a repeated product past 99 (422), a blank order id (400). `CURRENCY_MISMATCH` cannot be reached over HTTP with the memory prices adapter (all USD, and the provider token is not in the barrel); the domain spec covers it.
  - Minor, done: the arrow depth in `commandFields`, the duplicated error-class name (`errorClass`), sibling-name validation in `hex-use-case`, the untested route-path error, the `resolveSlice` message when the README has no Subdomains heading. Not done: the HTML splice edge cases (no concrete failing case in the review, and the dialect has no caller yet), and `defineDialect` (upstream PB-16).
  - Checks: `bun test schematics` 288 pass; `nx run-many -t lint test typecheck` green for 18 projects; `prettier --check .` clean.

- [x] S10 (db0b468, 90e5ba9, ad5afe6, aba8bd6): create new files from SDK templates (user decision, 2026-10-08). The approach is a hybrid:
  - Docs parsing, decisions and computed names and lists stay in TypeScript.
  - Every NEW file is rendered from a package-local template with `create(path, { templateFile, options })`, or with `scaffold` for a folder. The template lives in each schematic's `files/` folder.
  - Templates stay dumb: only `{= =}` interpolation and simple `range` over precomputed values. No arithmetic, no emptiness checks, no casing pipes on non-strings (the Go text/template pitfalls).
  - Delete the `createFile` escape hack.
  - Edits to existing files stay on the dialects (S7).
  - Prove it: regenerating ordering and the web libs gives an empty diff, re-runs stay no-ops, and `one-write-per-path` and the compiles test stay green.
  - Keep the skill, AGENTS.md and IMPACT in sync.

  Done (route: single writer, strict TDD; trigger evidence: 40+ files across `schematics/`):
  - Templates: 54 `files/**/*.template` files. hex-bounded-context 19 (the lib folder, the ring `.gitkeep` files, the README, two glossaries, the domain model, the flows), hex-slice 6, hex-driven-port 3, hex-use-case 3, hex-route 2, web-context 13 (the Angular and the domain lib), ng-component 4, ng-service 2, ng-directive 2.
  - `_shared` cannot hold templates: the engine reads them from the package that runs, and `hex-subdomain` and `hex-context` run the leaf factories in their own process, so a leaf's `files/` is unreachable from them. The SDK checks the path lexically (no `..`) and follows symlinks, so those two link the template folders of the leaves, and `web-shared-lib` links `web-context/files`. `scaffold` refuses a symlinked `from`, so the link sits above it.
  - Stays in TypeScript: docs parsing and the decisions they drive, computed names, the Classification, Subdomains and Context map sections (they are also appended to an existing README), the prejoined lists (imports, bindings, the members of a class). The templates only interpolate and `range` over lists the factory prepared; `templates.fitness.test.ts` keeps them to that.
  - The tests cannot see a rendered template: `runFactoryForTest` stores it as written, so a file created and edited in one run (the controller, the nested slice module) was an edit of the template. `_shared/testing.ts` has `runFactory`, which renders a created file the way the engine does before the next read, with `_shared/render.ts` for the Go text/template subset we allow. It imports `defineFactory` and `ContractFake` from the SDK by file.
  - Engine facts found by running it: a text option that reads as a JSON list or object is decoded (`'{}'` prints `map[]`), so factories never pass one (the `{{= .members =}}` trick keeps `{}` in the template); arrays of objects iterate with `.field`; trim markers and `{= "{=" =}` work; an empty template file writes an empty file.
  - RED: `render.test.ts` and `testing.test.ts` failed on the missing modules, `gherkin.test.ts` on `stepsOptions`, `templates.fitness.test.ts` on `createFile`. The conversion commits are pure refactors: the 288 existing tests stayed green on each (303 at each commit, 328 at the end with the new ones).
  - Proof, builder v0.9.11 in a scratch workspace (the old tree at f7970fb against the new one): `hex-bounded-context` then `hex-context` for ordering, a nested context with its docs and a `@catalog` adapter (`hex-bounded-context` then `hex-subdomain`), an inline context, `web-context`, `web-shared-lib`, `ng-component` (typed inputs and outputs, and a container), `ng-service` (with and without fields) and `ng-directive`: every generated file is byte-identical. Against the repo: the files of ordering nobody edited (project, tsconfigs, vitest config, steps index, errors, filter, `.gitkeep`) are identical; the rest differs only by hand edits, import order and prettier. `hex-context --context=ordering` on the repo re-runs as "no changes" and `git status` stays clean. The Angular `tsconfig.lib.json` of `web-ordering` differs in exclude order from the template: it did before this change too.
  - Stryker on ordering 100.00 (123 mutants, 0 survived). The sandbox could not copy the symlinks (`ENOTSUP`), so `stryker.config.json` now ignores `schematics` (aba8bd6).
  - Checks at the last commit: `bun test schematics` 328 pass; `nx run-many -t lint test typecheck` green for 18 projects; `prettier --check .` clean; `eslint schematics` and `tsc -p schematics` clean.

- [x] S11 (dc33081, acaf8c5, f3fb8b6): findings from the S9/S10 reviews. Four slices, all approved and acknowledged on 2026-10-08:
  - review-0a17fef4731c7aad (S9, 52f82ac..f7970fb)
  - review-b5985f55821573b0 (S10a, ..db0b468)
  - review-58f91ff5adecae6f (S10b, ..90e5ba9)
  - review-09ab0a68cd7a52a0 (S10c, ..aba8bd6)

  The envelopes carry only an id and a location per finding, so each one needs a verification before it is fixed.

  Warnings:
  - `web-shared-lib/factory.ts:25-34`: the fail-closed guard against regenerating over an existing lib may be gone with `createFile`. Check whether `scaffold` overwrites.
  - `stryker.config.json:18`: `schematics` is ignored by the sandbox.
  - `_shared/testing.ts:8-9`: private SDK imports (`defineFactory`, `ContractFake` by file path).
  - `_shared/testing.ts:269-286`: the fixture is unsafe under concurrent runs.
  - `hex-bounded-context/factory.ts:182-186`: a purpose that reads as JSON is decoded by the engine.
  - `templates.fitness.test.ts:70-79`: the fitness check is not transitive.
  - `_shared/lib.ts:4`: unseen dependencies.

  Suggestions:
  - `lib.ts:111`
  - `hex-route/factory.ts:150-156`
  - the error-filter template with empty statuses
  - the symlinked templates and a possible symlink cycle
  - top-level await in the seed
  - the dumbness check only parses, the inline-template detector is narrow, and the named regex check is vacuous

  Also: the suspected SDK issues (a text option decoded as JSON, `runFactoryForTest` keeps templates unrendered, `scaffold` refuses a symlinked `from`, and `defineFactory` and `ContractFake` have no public subpath) are not filed yet; that is the user's call.

  Done (route: single writer, strict TDD; trigger evidence: 7 files across `schematics/`). Verdict per finding:
  - `web-shared-lib/factory.ts:25-34`: not real. `scaffold` keeps the refusal. Real engine (builder v0.9.11, scratch workspace): a second run of `web-shared-lib` fails with `create failed at libs/web/shared/zz/eslint.config.mjs: path-collision`. With `project.json` deleted it still refuses and writes nothing, and the alias is registered once. `web-context` (`libs/web/zzweb/ui/eslint.config.mjs`) and `hex-bounded-context` (`libs/api/zzctx/COD100.md`) refuse the same way. The SDK types say it too: a create over an existing file is rejected unless `force: true`, and `scaffold` passes `force` (default false) to every file. The existing factory tests already cover it.
  - `stryker.config.json:18`: not real, kept. Mutation targets `libs/api/*/src/{domain,application}`; no lib imports from `schematics/`, and the root vitest projects glob finds no config in it (the schematics run on `bun test`). Ignoring it hides nothing the mutants touch, and it is what avoids the ENOTSUP copy of the symlinked template folders. Stryker was not rerun: the config did not change.
  - `_shared/testing.ts:8-9`: no public subpath (`@pbuilder/sdk`, `/commons` and `/testing` export neither). Kept the import with a one-line WHY and listed it as a suspected SDK issue above.
  - `_shared/testing.ts:269-286`: not real. The SDK keeps the active run in `AsyncLocalStorage`, and a throwaway test that interleaved two `runFactory` calls with timers and a shared seed saw no leak and left the seed untouched. `webLibs` already runs two in `Promise.all`. Not kept as a test.
  - `hex-bounded-context/factory.ts:182-186`: real (acaf8c5). Reproduced on the real engine: `--purpose='{}'` wrote `map[]` into the README and `COD100.md`. The schematic now refuses a purpose that reads as a JSON object or list, before writing. RED: 3 new cases failed (`{}`, `["a"]`, `{"a": 1}`). IMPACT row added; the skill line updated. Scalars (`42`, `"x"`) were not reproduced, so they are not refused.
  - `templates.fitness.test.ts` (dc33081):
    - 70-79 not transitive: real. `hex-context` runs `hex-subdomain`, which names no file, so the check passed with a leaf folder missing. It now follows callees transitively and expands a named folder to its files. RED: with `hex-context/files/route` removed, the old test passed (26 pass) and the new one failed.
    - nested symlinks: real. `scaffold` silently skips a nested symlinked directory, so a new test refuses any symlink below a walked folder. RED: a link planted in `hex-bounded-context/files/lib` failed the new test (and the template walk).
    - 57 inline detector: real. `/\btemplate:/` missed the shorthand and quoted keys; the new pattern is tested on four forms and on `templateFile`.
    - 25-28 vacuous regex: real. A floor (more than 20 names overall) and a per-schematic check that a factory with `templateFile` or `scaffold(` names at least one.
    - 19-23 symlink cycle: not real. A cycle throws `ELOOP` (reproduced), it does not hang, and none exists.
    - 50 only parses: not real. `parse` is the whole subset and throws on anything else; `render.test.ts` already covers the rejected actions.
  - `_shared/lib.ts:4`: not real, not reproducible. The file imports only `@pbuilder/sdk/commons`. Every other package the schematics import resolves from `package.json` (`@pbuilder/sdk` brings `ts-morph`; `@angular/compiler` and `postcss` are devDependencies); a scratch workspace without them fails with "factory module could not be resolved or loaded".
  - Suggestions:
    - `lib.ts:111` (`strip`): not real. Escaped pipes, backticks, empty cells and trailing blanks read as documented.
    - `hex-route/factory.ts:150-156`: real (f3fb8b6). A row that `parseRoute` rejects was dropped silently, so the error said the route was "not in the table". It now lists the unreadable rows. RED: the new test failed. (The "pass --path" rule for several rows stays: a test asserts it. The schema label says "default: /", which is loose.)
    - error filter with empty statuses: not a defect. It renders `STATUS = { }` and a later run fills it; a test was added, green at once.
    - top-level await in the seed: not real. Importing `testing.ts` takes about 0.5 s and a failure rethrows the factory's own error.
  - Checks at the last commit: `bun test schematics` 335 pass; `nx run-many -t lint test typecheck` green; `prettier --check .` clean. The pre-commit hook also ran eslint, `tsc -p schematics` and the schematics tests on each commit.
  - Deviation: the `_shared/testing.ts` comment change went into f3fb8b6 with the hex-route fix.

- [x] S12 (9e89656): use `scaffold` instead of several `create` calls where a schematic always writes the same fixed set of files into one folder. `scaffold` translates `__x__` tokens in file names and strips `.template` (see the SDK commons typings).
  - Candidates: ng-component (4 files), ng-directive (2), ng-service (2), and the fixed part of hex-slice.
  - Keep `create` where it is justified: a conditional create-if-missing (the hex-bounded-context docs), a choice between template variants (glossary vs glossary-nested, the hex-driven-port adapter), or files in different folders (hex-route, hex-use-case).
  - Depends on the S11 verdict on whether `scaffold` keeps the fail-closed refusal over existing files: it does (see S11, first finding).
  - Proof: byte-identical output and the suite green.

  Done (route: single writer; the existing tests are the RED of a refactor, so none was added):
  - Converted: ng-component (4 files), ng-directive (2), ng-service (2). Templates moved to `files/<kind>/__name__.<ext>.template`, one `scaffold({ from, to, options })` each with the options merged. Factories: 38 lines out, 16 in (net -22: ng-component -14, ng-service -5, ng-directive -3).
  - Skipped: hex-slice. Its files are not a fixed set: `errors.ts` is a choice between two variants, and `composition.ts` is written only for a nested slice, in another folder. The rings were already a `scaffold`.
  - Proof, builder v0.9.11, scratch workspaces for HEAD 3f4d8a6 and for the new tree: `web-context`, then `ng-directive`, `ng-service` (with and without fields) and `ng-component` (typed inputs and outputs, and a container in a folder). `diff -r` of the 39 generated lib files and the root files: identical. Both trees refuse a second `ng-directive` run with `path-collision`.
  - Deviation, a message regression: the engine words the collision with the path as scaffold's token names it (`.../highlight/{= .name =}.spec.ts: path-collision`) instead of `highlight.ts`. The refusal is the same. The three factory tests now assert the folder, `src/lib/<folder>/`. Suspected SDK issue (not filed): a collision over a scaffolded file names the unrendered path.
  - Checks: `bun test schematics` 335 pass (the commit hook also ran eslint and `tsc -p schematics`); `nx run-many -t lint test typecheck` and `prettier --check .` below.

## Next step

S5 to S12 are done. The S11 and S12 review (review-27a9c8a20286306e) was approved and acknowledged on 2026-10-08. It left advisory items only: the collision message names the unrendered `scaffold` path, the callee walk has no cycle guard, and a JSON `null` purpose is not refused. Slice 2 (`order-fulfilment-slice-2.md`) can generate its filter, starting with U5. Stryker on ordering: 100.00 (123 mutants, 0 survived). Last checks: `bun test schematics` 335 pass; `nx run-many -t lint test typecheck` green for 18 projects.
