# Slice 2: stock reservation, payment and order events

## Objective

Placing an order reserves stock, charges the payment, commits the stock and marks the order `Paid`, then publishes domain events. This touches three contexts: inventory, payments and ordering.

## Problem / why

Slice 1 only modelled the order lifecycle. A realistic order flow needs cross-context coordination: a process manager with compensation, plus events. That is the next real exercise for the schematics. It is the first real use of `hex-driven-port kind=context` and the context map.

## Decisions (user, 2026-10-08)

- **Coordination is orchestration inside ordering.** A process manager in ordering calls inventory and payments through their public barrels. This fits the declared context map: ordering depends on inventory (customer-supplier) and on payments (acl). It compensates on failure. No cycles.
- **Events.** Ordering publishes `OrderPaid` and `OrderCancelled` through a `DomainEvents` driven port with a Memory adapter. Shipping and notifications consume them in slice 3, through ordering's barrel, which the context map already allows.

## PlaceOrder flow (synchronous, one request)

1. Validate the order (ordering rules 6 and 10).
2. `inventory.reserve`.
3. `payments.charge`.
4. `inventory.commit`.
5. Mark the order `Paid` and publish `OrderPaid`.

On `INSUFFICIENT_STOCK` or `PAYMENT_DECLINED`, the process manager releases what it reserved and the order **returns to `Draft`** with the error code, so the customer can fix it and retry. `Placed` becomes the transient state that lasts while the orchestration runs.

## Business rules (approved 2026-10-08, Source: decided)

### Inventory (aggregate `StockItem`: productId, onHand, reserved)

| #   | Rule                                                                                                                  | Error code            |
| --- | --------------------------------------------------------------------------------------------------------------------- | --------------------- |
| I1  | A reservation is all-or-nothing. Every line needs `available = onHand − reserved` to be at least its quantity.        | `INSUFFICIENT_STOCK`  |
| I2  | There is one reservation per order. Reserving again for the same order returns the existing reservation (idempotent). | None                  |
| I3  | Releasing a reservation returns its quantities. Releasing an unknown or already released reservation is a no-op.      | None                  |
| I4  | Committing a reservation decrements both onHand and reserved.                                                         | None                  |
| I5  | A product with no stock record is refused.                                                                            | `PRODUCT_NOT_STOCKED` |
| I6  | The stock level is an integer of 0 or more. Routes: `PUT /stock/:productId` and `GET /stock/:productId`.              | `STOCK_LEVEL_INVALID` |

### Payments

Aggregate `Payment`: Pending → Captured, Failed or Refunded. A fake `PaymentGateway` sits behind an ACL.

| #   | Rule                                                                                                                           | Error code               |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| P1  | The amount is greater than 0.                                                                                                  | `INVALID_AMOUNT`         |
| P2  | There is one successful charge per order, with the orderId as the idempotency key. Charging again returns the existing charge. | None                     |
| P3  | A gateway decline leaves the payment `Failed`.                                                                                 | `PAYMENT_DECLINED`       |
| P4  | Only a `Captured` payment can be refunded.                                                                                     | `PAYMENT_NOT_REFUNDABLE` |
| P5  | `PlaceOrder` takes an opaque `paymentMethodToken` and never card data. The fake declines `tok_decline`.                        | None                     |

### Ordering changes

- `PlaceOrder` ends in `Paid`. `Placed` is transient.
- Rule 8 becomes reachable: a `Paid` order is not cancellable (`ORDER_NOT_CANCELLABLE`).
- `CancelOrder` publishes `OrderCancelled`.
- `PlaceOrder` gains `paymentMethodToken` in its command and route body.

## Assumptions

Product decisions the approved rules leave open, taken as the simplest reading and not yet confirmed by the user. Inventory records them as `assumed` rules 7 to 11 with `@draft` scenarios (`docs/inventory/domain-model.md`).

- **Reservation is a second small aggregate** (orderId, lines, status `Held`, `Released` or `Committed`) behind a `Reservations` port, because a reservation spans several `StockItem`s and release and commit must move exactly what was reserved.
- **Reserving again for an order** returns the existing reservation when it is held or committed (I2). A released one no longer counts, so the retry after a compensation reserves again (rule 8). Without this the F3 retry would reserve nothing.
- **Commit and release apply only to a held reservation** (rule 9). Committing an unknown, released or committed reservation, or releasing a committed one, is a silent no-op: the approved codes have no refusal for it.
- **`PRODUCT_NOT_STOCKED` wins over `INSUFFICIENT_STOCK`** when a reservation has both (rule 10): every line is looked up before any is applied.
- **`PUT` creates the record** of a product with none (rule 7) and **refuses a level below the reserved count** with `STOCK_LEVEL_INVALID` (rule 11), so `reserved <= onHand` always holds and `available` is never negative.
- **Caller contract of `ReserveStock`:** lines name distinct products with a quantity of 1 or more. Ordering guarantees it (its rule 2 and one line per product); inventory does not re-check it, as no approved code covers it.
- **Seed:** the Memory adapter seeds `keyboard`, `mouse` and `monitor` with 50 units each, the products ordering's `MemoryProductPrices` knows.
- **Routes:** only `PUT` and `GET /stock/:productId`. Reserve, release and commit have no route; ordering reaches them through the barrel in F3. `INSUFFICIENT_STOCK` therefore has no HTTP status.

## Out of scope

- Crash-safety in the middle of the orchestration. That needs an outbox or a persistent process manager, and is recorded as a follow-up.
- Refunding when a paid order is cancelled.
- Event consumers (shipping, notifications).
- Optimistic concurrency. It is an open follow-up from slice 1 and must land before a real database adapter.
- Auth.

## Constraints

- Docs-first, then the schematics.
  - Inventory and payments get `docs/<ctx>/domain-model.md` and `.feature` files.
  - Ordering's docs change for the new flow.
  - Generate everything with `hex-subdomain`, `hex-driven-port kind=context`, `hex-route` and the other schematics.
  - Every miss or defect goes to `schematics/IMPACT.md`, and a fitting fix goes into the schematic with tests. Never hand-write scaffolding.
- Cross-context calls go only through barrels. The context map and lint must accept them.
- Strict TDD, with the 90% coverage gate on domain and application, and Stryker break at 90 per context.
- No builds or boots.

## Tasks

- [x] F1: inventory docs and generation, then domain and use cases with TDD. Route: delegated writer.
- [ ] F2: payments docs and generation, including the ACL gateway fake, then domain and use cases with TDD. Route: delegated writer.
- [ ] F3: ordering. Update the docs, add the cross-context ports with `kind=context`, the `DomainEvents` port, and the PlaceOrder process manager with compensation, all with TDD. Route: delegated writer.
- [ ] F4: Stryker on inventory, payments and ordering. Record the IMPACT rows. Route: delegated writer.
- [ ] F5: UI. Slices are vertical (user decision, 2026-10-08), so this slice ships its UI. Route: delegated writer.
  - Add a payment-token field to Place, which shows `PAYMENT_DECLINED` or `INSUFFICIENT_STOCK` and leaves the order back in Draft.
  - Show the `Paid` status.
  - Add an inventory stock page at `/stock/:productId` (GET and PUT the level) in `libs/web/inventory`, generated with `web-context`.

## Acceptance criteria

- Every scenario is green in the three contexts.
- The compensation paths are tested: no stock, and a declined payment, each leave no reserved stock and the order back in `Draft`.
- Lint passes, including module boundaries.
- Coverage and Stryker gates pass.
- IMPACT rows are recorded.

## Progress

- 2026-10-08: document created. The slice and its rules were approved by the user. It waits for `schematics-impact-round-1.md` to finish.
- 2026-10-08: U5 done (091c767, 0778bf4, 7c96a1f); F5 can start.
- 2026-10-08: F1 done in 308c0a7, 584a03c, 4632953, 19f0a51, 5864360, a5ad20e, f414561, 2525479, 949a91e, 418ce8c and 37590b8. Route: delegated writer (2+ non-trivial files per step). Resolved TDD mode: strict, source the user's global configuration, runner `bunx nx test api-inventory` (vitest 4 and quickpickle) and `bun test schematics`.
  - Docs (308c0a7, 4632953): `domain-model.md` (2 aggregates, 11 rules, 5 use cases, 2 ports, 2 routes), `glossary.md`, `flows.md` and five `.feature` files with 27 scenarios; rules 7 to 11 are `assumed` with `@draft` scenarios (see Assumptions). 4632953 changed assumed rule 11 from "may fall below reserved" to "refused", because the first reading let a commit drive `onHand` negative.
  - Generation (584a03c): `hex-subdomain --context=inventory --slice=inventory` standalone, 20 files in one pass with no refusal and no schematic change; prettier only. RED: all 26 scenarios then failed on `step not implemented`.
  - Schematic fix (5864360): the steps `index.ts` template now loads `./world.ts` first. RED: the new factory test failed on the old template; GREEN 336 pass in `bun test schematics`. Found by the first run of the inventory steps (`world.attempt is not a function`).
  - Domain (19f0a51): RED `Cannot find module './StockLevel'` (and the other two), then 27 domain tests; the `Reservation` spec was extended first (3 RED), so a settled reservation cannot be settled again.
  - Ports and adapters (a5ad20e): RED 10 adapter tests failing (`byId is not a function`), then green. Hand edits to generated files: the two port interfaces and the two Memory adapters, with the seed.
  - Use cases, in order (f414561, 2525479, 949a91e), each starting from the previous failures:
    - `SetStockLevel` and `GetStockLevel`: 27 scenarios failing on `SetStockLevel is not implemented`; after them 22 failing, 5 passing. The controller got the `onHand` body schema and `.trim().min(1)` on the id.
    - `ReserveStock`: 22 failing; after it 11 failing (the rest need release or commit).
    - `ReleaseStock`: 11 failing, then 7. `CommitStock`: 7 failing, then 60 of 60 passing.
  - Wire (418ce8c): `apps/api/src/app/stock.http.spec.ts` (seed, set and get, 404, 422, 400). RED observed by reverting the body schema to `z.object({})`: 2 of 4 failed; restored and 47 api tests pass.
  - Schematics used: `hex-subdomain` (use, twice: generation and hand-written part) and, through it, `hex-slice`, `hex-driven-port` x2, `hex-use-case` x5 and `hex-route` x2. IMPACT rows: 2 use (hex-subdomain) and 1 defect (hex-bounded-context steps index). No misses.
  - Final checks: `bunx nx run-many -t lint test typecheck` succeeded for 18 projects; `bun test schematics` 336 pass; `bunx prettier --check .` clean; `nx test api-inventory` 60 tests, 97.59% statements, 100% branches, functions (gate 90%; the 2 statements not covered are the `Symbol` token lines of the two port files, none in a use case or a domain rule). Stryker (`bunx stryker run`, the repo config over every context, 1 min 27 s): total 100.00, inventory 100.00 (79 killed, 0 survived, 0 no coverage), ordering 100.00; break 90.
  - Context map: unchanged. `ordering -> inventory` (customer-supplier) was already declared in the README and `eslint.config.mjs`; F1 wires nothing in ordering; lint passes.

## Next step

F2: payments docs and generation, including the ACL gateway fake, then domain and use cases with TDD. F3 will call `RESERVE_STOCK`, `RELEASE_STOCK` and `COMMIT_STOCK` from `@demo/api-inventory`; they take `{ orderId, lines: { productId, quantity }[] }` and `{ orderId }`.
