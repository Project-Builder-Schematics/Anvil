# Ordering: first slice (order lifecycle)

## Objective

Model and implement the first slice of the `ordering` core context: the order lifecycle Draft → Placed → Cancelled, with lines and frozen prices. Docs come first, the code is generated with the project schematics, and the domain is implemented with strict TDD.

## Problem / why

The demo exists to exercise the "when to add a schematic" loop on real domain code. This is the first real use of the hex schematics, and the first domain code, which unblocks Stryker (T8 in `workspace-scaffold.md`).

## Scope

In scope:

- Aggregate `Order`, with entity `OrderLine` and value objects `OrderId`, `ProductId`, `Quantity` and `Money` (minor units plus currency).
- Use cases and routes:

  | Use case       | Route                          |
  | -------------- | ------------------------------ |
  | `CreateOrder`  | `POST /orders`                 |
  | `AddOrderLine` | `POST /orders/:orderId/lines`  |
  | `PlaceOrder`   | `POST /orders/:orderId/place`  |
  | `CancelOrder`  | `POST /orders/:orderId/cancel` |
  | `GetOrder`     | `GET /orders/:orderId`         |

- Driven ports `OrderRepository` and `ProductPrices`, both with Memory adapters. `ProductPrices` moves to `@catalog` once catalog has a domain.

Out of scope:

- Paid and Shipped transitions.
- Inventory reservation, payments and domain events. These come in the next slice.
- Auth and customer ownership.
- The frontend.

## Business rules (approved by the user, 2026-10-08; Source: decided)

| #   | Rule                                                                                             | Error code              |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------- |
| 1   | An order starts as `Draft` with no lines.                                                        | None                    |
| 2   | Quantity is an integer from 1 to 99 inclusive.                                                   | `QUANTITY_OUT_OF_RANGE` |
| 3   | Adding a product already in the order adds to that line, and the sum must still satisfy rule 2.  | `QUANTITY_OUT_OF_RANGE` |
| 4   | Only a `Draft` order may change its lines.                                                       | `ORDER_NOT_EDITABLE`    |
| 5   | The unit price is frozen when the line is added. An unknown product is refused.                  | `PRODUCT_NOT_FOUND`     |
| 6   | Placing requires at least one line.                                                              | `ORDER_EMPTY`           |
| 7   | Every line of an order uses the same currency.                                                   | `CURRENCY_MISMATCH`     |
| 8   | An order may be cancelled from `Draft` or `Placed`. `Paid` and later states are not cancellable. | `ORDER_NOT_CANCELLABLE` |

## Constraints

- **Docs-first.** Write `docs/ordering/domain-model.md`, `glossary.md`, `flows.md` and one `.feature` per use case in the exact grammar the schematics parse (see the `schematics` skill). Then run `hex-subdomain`.
- **No hand-written scaffolding.** Any Nest or Angular artifact comes from a schematic. When a schematic doesn't fit, record a miss in `schematics/IMPACT.md`, or fix or extend the schematic with its own tests first.
- **Domain logic is pure and framework-free.** Ports use Symbol tokens. Validation is Zod schema-first at the controller.
- **Caller.** No auth exists yet, so routes are public for this slice, recorded as an open item. Request bodies never carry a customer, user or actor id.
- **No builds or boots.** Runtime verification is listed for the user.

## TDD

Strict.

- Domain and use cases follow the `.feature` scenarios through quickpickle steps, plus unit tests for the value objects.
- An observed RED comes before GREEN.
- The runner is vitest 4 via `nx test api-ordering`; the schematics use `bun test schematics`.

## Tasks

- [x] O1: write the docs: domain model, glossary, flows and five `.feature` files. Route: delegated writer.
- [x] O2: generate with `hex-subdomain`. Record the IMPACT rows (use or miss). Route: delegated writer.
- [ ] O3: implement the value objects and the `Order` aggregate with TDD. Route: delegated writer.
- [ ] O4: implement the use cases and steps until every scenario is green. Coverage gate: domain and application at 90%. Route: delegated writer.
- [ ] O5: run Stryker end to end on api-ordering (this closes T8). Record the mutation score. Route: delegated writer.

## Acceptance criteria

- Every `.feature` scenario passes under `nx test api-ordering`.
- Lint, typecheck and format pass.
- The 90% coverage gate passes for domain and application.
- Stryker runs end to end with a recorded score.
- `IMPACT.md` has rows for this real use.

## Progress

- 2026-10-08: document created. The slice and its rules were approved by the user.
- 2026-10-08: O1 done in 329013e `docs(ordering)`. Route: one writer for O1 to O5 (delegated, 2+ non-trivial files per task). Resolved TDD mode: strict, source the user's global configuration, runner `bunx nx test api-ordering` (vitest 4 and quickpickle) and `bun test schematics`.
  - Docs written in the schematics' grammar: `domain-model.md`, `glossary.md`, `flows.md` (5 sequence diagrams) and five `.feature` files, with `Rule:` blocks citing rule numbers. `README.md` gained the missing `## Subdomains` table, which `resolveSlice` needs (logged in IMPACT).
  - **Ambiguities, added as `assumed` rules and `@draft` scenarios (the user must confirm):**
    - Rule 9: a command naming an unknown order. The approved rules have no code for it, but four of five use cases need one. Chosen `ORDER_NOT_FOUND`, 404.
    - Rule 10: placing a non-Draft order. Chosen to refuse with `ORDER_NOT_EDITABLE` (409).
    - Rule 11: precedence when several refusals hold. Chosen: not found, quantity range, unknown product, order state, merged sum, currency (for `AddOrderLine`); not found, state, empty (`PlaceOrder`); not found, not cancellable (`CancelOrder`).
    - Rule 8 mentions `Paid`, which this slice does not have, so the refusal is reachable only from `Cancelled`.
    - Status mapping (the approved rules name codes only): 404 for rule 9, 409 for rules 4, 8, 10, 422 for rules 2, 3, 5, 6, 7, 400 for the Zod body check. `AddOrderLine` answers 200, not 201, because it may merge into a line. All of this is in the Driving adapters table.
  - Parsers checked with a scratch script over `schematics/_shared`: every table, the 11 rules, 7 error codes and 17 step phrases parse.
  - Checks: `bun test schematics` 235 pass; `bunx nx run-many -t lint test typecheck` succeeded for 18 projects; `bunx prettier --check` clean for the docs.
- 2026-10-08: O2 done in 26f44ed `fix(api)` and 3416746 `feat(ordering)`. `builder info default:hex-subdomain`, then `env -u BUILDER_MANIFEST -u BUILDER_SDK_ROOT builder execute default:hex-subdomain --context=ordering --slice=ordering` standalone, prettier on the listed files, every generated file read. It generated 19 files in one pass with no refusal and needed no schematic change.
  - RED recorded: `bunx nx test api-ordering` runs 33 scenarios as "passed" because the pending steps return `'skipped'`, and fails the 90% coverage gate at 0% (statements 0 of 23). Logged as a defect row.
  - The first `AppModule` import of the context broke `apps/api` tests (`Cannot find package '@demo/api-ordering'`); fixed with `resolve.tsconfigPaths` in the api vitest config (26f44ed).
  - IMPACT rows: 1 use (hex-subdomain), 3 defects (hex-bounded-context README without Subdomains, hex-route exposing the api alias gap, hex-use-case vacuous pending steps).
  - Checks at the commit: `bunx nx run-many -t lint typecheck` succeeded; `bun test schematics` 235 pass; `nx test api-ordering` fails on coverage on purpose (the RED).

## Next step

O3.
