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

Product decisions the approved rules leave open, taken as the simplest reading. Inventory rules 7 to 11 (`docs/inventory/domain-model.md`) and payments rules 6 to 11 (`docs/payments/domain-model.md`) were confirmed by the user on 2026-10-09 (938326e for payments) and are now `decided`, with their `@draft` tags removed. Payments rules 12 to 14 were decided by the user on 2026-10-09 (F2b).

- **Reservation is a second small aggregate** (orderId, lines, status `Held`, `Released` or `Committed`) behind a `Reservations` port, because a reservation spans several `StockItem`s and release and commit must move exactly what was reserved.
- **Reserving again for an order** returns the existing reservation when it is held or committed (I2). A released one no longer counts, so the retry after a compensation reserves again (rule 8). Without this the F3 retry would reserve nothing.
- **Commit and release apply only to a held reservation** (rule 9). Committing an unknown, released or committed reservation, or releasing a committed one, is a silent no-op: the approved codes have no refusal for it.
- **`PRODUCT_NOT_STOCKED` wins over `INSUFFICIENT_STOCK`** when a reservation has both (rule 10): every line is looked up before any is applied.
- **`PUT` creates the record** of a product with none (rule 7) and **refuses a level below the reserved count** with `STOCK_LEVEL_INVALID` (rule 11), so `reserved <= onHand` always holds and `available` is never negative.
- **Caller contract of `ReserveStock`:** lines name distinct products with a quantity of 1 or more. Ordering guarantees it (its rule 2 and one line per product); inventory does not re-check it, as no approved code covers it.
- **Seed:** the Memory adapter seeds `keyboard`, `mouse` and `monitor` with 50 units each, the products ordering's `MemoryProductPrices` knows.
- **Payments, amount and currency:** the amount is an integer in minor units, so a fractional one is refused with `INVALID_AMOUNT` (rule 6). The currency is carried as given and not re-checked, since ordering guarantees it (rule 11). `api-shared-kernel` is empty, so `Amount` (greater than 0) is local and does not duplicate ordering's `Money` (0 or more).
- **Payments, retries and precedence:** only a `Captured` or `Refunded` payment counts as the order's charge (P2), so charging an order whose payment is `Failed` charges again and replaces it, which the F3 retry needs (rule 7). `INVALID_AMOUNT` is checked before the existing payment is looked up (rule 10).
- **Payments, idempotency key (user decision, 2026-10-09, F2b):** the key is the id of the `Payment`, not the order id, which amends P2's wording. The reason is Stripe's behaviour (https://docs.stripe.com/api/idempotent_requests): it saves the outcome of the first request for a key, success or failure, and errors when later parameters differ, so an order-id key would replay a decline and break rule 7. A `Failed` payment is replaced by a new payment with a new id.
- **Payments, retry of a `Pending` payment (to confirm with the user):** the payment keeps no token (rule 5), so a retry of a `Pending` payment goes to the gateway with that payment's key and the retry's own request, not a stored one. If it matches the first request the gateway replays the outcome (money taken once); if it differs the gateway refuses it, the fake throws a plain error that the use case treats like any gateway failure, and the payment stays `Pending` until a retry with the first request resolves it. The alternative is to keep the token on the `Pending` payment (changes rule 5) and resolve with the stored request, so a retry with another token could not get stuck.
- **Payments, refund:** refunding an order with no payment is `PAYMENT_NOT_REFUNDABLE`, no new code (rule 8). A refund changes the payment only; the gateway has no refund operation (rule 9).
- **Payments, shape:** `ChargePayment` stores the payment as `Pending` before it calls the gateway (rule 12, which replaces the earlier "`Pending` is never stored"), stores a declined payment as `Failed` and then throws `PAYMENT_DECLINED`; if the gateway throws, the payment stays `Pending` and the error propagates. Both use cases answer `{ orderId, status, amount, currency }`. No route: ordering calls `CHARGE_PAYMENT` and `REFUND_PAYMENT` through the barrel, and `PaymentsModule` is not imported in `AppModule` yet.
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
- [x] F2: payments docs and generation, including the ACL gateway fake, then domain and use cases with TDD. Route: delegated writer.
- [x] F2b: fix the F2 review findings (review-ecbc7d7ed25bd7cc; user decision, 2026-10-09). Route: delegated writer. Commits 585f9d3, 5f4ad41, 950ae54, 5bd418d, 004c29e, af041d9, ee0c651 and e82f837. RED: the idempotency scenarios and gateway spec failed (8 tests), the Pending scenario and the `startCharge` spec failed (6 tests), the explicit declined amount failed 2 scenarios, the gherkin test received two bindings. Checks: `nx run-many -t lint test typecheck` green for 18 projects, `bun test schematics` 339 pass, prettier clean, Stryker payments 100.00. Follow-up (user, 2026-10-09): the idempotency key is the payment id; RED 24 tests.
- [ ] F3: ordering. Update the docs, add the cross-context ports with `kind=context`, the `DomainEvents` port, and the PlaceOrder process manager with compensation, all with TDD. Route: delegated writer.
- [ ] F4: Stryker on inventory, payments and ordering. Record the IMPACT rows. Route: delegated writer.
- [ ] F5: UI. Slices are vertical (user decision, 2026-10-08), so this slice ships its UI. Route: delegated writer.
  - Add a payment-token field to Place, which shows `PAYMENT_DECLINED` or `INSUFFICIENT_STOCK` and leaves the order back in Draft.
  - Show the `Paid` status.
  - Add an inventory stock page at `/stock/:productId` (GET and PUT the level) in `libs/web/inventory`, generated with `web-context`.

## Review follow-ups

On 2026-10-09 the U5 review (754935a..07d9f81, review-88533ca97c6f7b39) and the F1 review (07d9f81..fdb9216, review-77c9c8af12fe259d) were approved and acknowledged. They left these follow-ups:

- [ ] F3 (user decision, 2026-10-09): `ReserveStock` loads each stock item once, so two lines for the same product make the second save overwrite the first and reserve too little (ReserveStock.ts:28-31). F3 either merges or refuses duplicate lines in `ReserveStock`, or proves with a test that the process manager sends distinct lines.
- [ ] `ReserveStock` reads, modifies and writes `StockItems` with no concurrency control, so a concurrent update can be lost (ReserveStock.ts:24-35). This joins the optimistic concurrency follow-up (out of scope), which must land before a real database adapter.
- [ ] U5: a stale command result answers `false` and leaves no trace (order-store.ts:85-86). Verify that this is the intended "no error" assumption and that a test covers it.
- [ ] U5: the `readonly lines` spec only checks types (`@ts-expect-error`) and asserts nothing at runtime (order.spec.ts:29-36). The web libs have no `typecheck` target, so CI never checks it. Add a typecheck target for the web libs, or drop the spec.

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
- 2026-10-09: F2 done in e9d9c03, 6bf499d, adde164, e343750, 290853c, d54f700, b08c242 and bd5455b, plus two schematic fixes (047d84c, c174f69). Route: delegated writer (2+ non-trivial files per step). Resolved TDD mode: strict, source the user's global configuration, runner `bunx nx test api-payments` (vitest 4 and quickpickle) and `bun test schematics`.
  - Docs (e9d9c03, 6bf499d): `domain-model.md` (1 aggregate, 11 rules, 2 use cases, 2 ports, no route), `glossary.md`, `flows.md` and two `.feature` files with 17 scenarios; rules 6 to 11 were `assumed` with `@draft` scenarios when written; the user confirmed them on 2026-10-09 (938326e) and they are `decided` (see Assumptions).
  - Schematic fixes, found while generating: 047d84c reads a decimal in a phrase as `{float}` (RED: it received `{int}.{int}`), and c174f69 keeps one `{float}` binding when a phrase has both integers and decimals (RED: quickpickle reported an ambiguous step). `bun test schematics` 338 pass.
  - Generation (adde164): `hex-subdomain --context=payments --slice=payments`, 11 files in one pass with no refusal. RED: 17 scenarios failed on `step not implemented`.
  - Domain (e343750): RED `Cannot find module './Amount'` for both specs, then 15 domain tests. Ports and adapters (290853c): RED 9 adapter tests failing (`charge is not a function`, `byOrderId`), then green. The fake gateway keeps its own `GatewayResult` in the adapter file and translates it to `Captured` or `Declined` (the ACL); the domain and the port never see it.
  - `ChargePayment` (d54f700): 17 scenarios failing on `ChargePayment is not implemented`, 5 failing after it (the refund ones and one that needs a refund). `RefundPayment` (b08c242): 5 failing, then 41 of 41 passing.
  - Schematics used: `hex-subdomain` (use, twice: generation and hand-written part) and, through it, `hex-slice`, `hex-driven-port` x2 and `hex-use-case` x2; no `hex-route`, as the docs declare no driving adapter. IMPACT rows: 2 use (hex-subdomain), 1 miss (hex-driven-port has no ACL or external adapter kind: the gateway adapter and its translation are hand-written) and 3 defects (the two gherkin fixes and the stale steps `index.ts` of the pre-fix skeleton).
  - Final checks: `bunx nx run-many -t lint test typecheck` succeeded for 18 projects; `bun test schematics` 338 pass; `bunx prettier --check .` clean; `nx test api-payments` 42 tests, 95.74% statements, 100% branches, functions (gate 90%; the uncovered statements are the `Symbol` token lines of the two port files). Stryker (`bunx stryker run --concurrency 3`, 10 min 31 s; the default 9 runners time out an `AppModule` test in the dry run): total 100.00, payments 100.00 (47 killed, 7 timeouts, 0 survived), break 90.
  - Context map: unchanged. `ordering -> payments` (acl) was already declared in the README and `eslint.config.mjs`; F2 wires nothing in ordering; lint passes.
- 2026-10-09: F2b done in 585f9d3, 5f4ad41, 950ae54, 5bd418d, 004c29e and af041d9. Route: delegated writer. TDD strict, runner `bunx nx test api-payments` and `bun test schematics`.
  - Double charge (5bd418d): `PaymentGateway.charge` takes `idempotencyKey` (the order id) and `MemoryPaymentGateway` honours it with `capturedKeys`; a decline is not remembered, so rule 7 still works. RED: 4 scenarios (`gateway has been charged 1 in total`, the key, the concurrent pair) and 4 gateway specs failed, then 48 tests green.
  - Unknown outcome (004c29e, docs 5f4ad41): rules 12 to 14 (decided, user, 2026-10-09 (F2b)). `Payments.startCharge(pending)` answers the order's charged payment or stores the `Pending` one, in one step, so a late concurrent call never overwrites a charge. `ChargePayment` saves `Pending` before the gateway, so a throw leaves it `Pending` and a retry resolves it. RED: the Pending scenario and 5 `startCharge` specs; the retry scenarios already passed after the key fix. No new error code.
  - Minor findings (af041d9): the steps assert the answer `{ orderId, status, amount, currency }`; the declined amount is explicit in the feature; rule 10 is pinned by a scenario that also checks the existing charge stays; the aggregate invariant wording follows the code (5f4ad41); the rule 6 to 11 source is `decided` (950ae54).
  - Schematics (585f9d3): `{float}` filter now groups phrases by shape. RED: both `{int} to {float}` and `{float} to {int}` came back. IMPACT: 1 defect row and 1 row with the costs of the F2 rows.
  - Follow-up (ee0c651, e82f837; user decision, 2026-10-09): the key is the id of the `Payment` (created `Pending`, `randomUUID()` in the use case), not the order id, because Stripe replays the first outcome per key, a failure included, and errors when the parameters differ. Rules 2, 12, 13 and 14, ports, flows and glossary follow. `MemoryPaymentGateway` remembers every outcome per key (`outcomes`), refuses the same key with other parameters with a plain `Error('idempotency key reused with different parameters')` (the simplest ACL translation: the use case treats it as any gateway failure and the payment stays `Pending`), and remembers nothing when the call throws. `startCharge` keeps a `Pending` payment and replaces only an absent or `Failed` one, so a retry after a decline is a new payment with a new key. RED: 24 tests failed (gateway replay, decline replay, mismatch refusal, new key after a decline, key equals the payment id, lost answer takes the money once with 1 key, retry with another request refused, `Payment.id`, `startCharge` keeping a `Pending`). Checks: lint, test and typecheck green for 18 projects, tsc on both payments tsconfigs, prettier clean; Stryker `--concurrency 3` total 100.00, payments 100.00 (51 killed, 2 timeouts, 0 survived).
  - Checks: `nx run-many -t lint test typecheck` green for 18 projects; `nx test api-payments` 57 tests, 95.65% statements, 100% branches and functions; `bun test schematics` 339 pass; prettier clean. Stryker (`--concurrency 3`): total 100.00, payments 100.00 (46 killed, 7 timeouts, 0 survived), break 90.

## Next step

F3: ordering. It calls `RESERVE_STOCK`, `RELEASE_STOCK` and `COMMIT_STOCK` from `@demo/api-inventory` (`{ orderId, lines: { productId, quantity }[] }` and `{ orderId }`) and `CHARGE_PAYMENT` and `REFUND_PAYMENT` from `@demo/api-payments` (`{ orderId, amount, currency, paymentMethodToken }` and `{ orderId }`, both answering `{ orderId, status, amount, currency }`). A decline throws `PaymentsError` with `PAYMENT_DECLINED`, but the barrel exports no error class yet, so the ACL adapter in ordering must read the `code` from the thrown error (or the barrel gains the export). Ordering's module must import `PaymentsModule` and `InventoryModule`. A retry after a gateway error that is not a `PaymentsError` finds the payment `Pending`; calling `CHARGE_PAYMENT` again resolves it.
