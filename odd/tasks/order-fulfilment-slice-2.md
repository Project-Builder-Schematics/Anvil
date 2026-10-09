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
- **Payments, retry of a `Pending` payment (decided — user, 2026-10-09: store the token):** the `Pending` payment keeps the opaque `paymentMethodToken` and the amount of its original request, so rule 5 no longer says the payment keeps none (P5 only says the token is opaque and never card data). A retry always resolves it with that stored request under its own key, so the gateway replays or completes it and the money is taken once; the retry's own token and amount are not used for that attempt. If the outcome is `Failed`, the next charge creates a new payment with the retry's request and a new key (rule 7).
- **Payments, refund:** refunding an order with no payment is `PAYMENT_NOT_REFUNDABLE`, no new code (rule 8). A refund changes the payment only; the gateway has no refund operation (rule 9).
- **Payments, shape:** `ChargePayment` stores the payment as `Pending` before it calls the gateway (rule 12, which replaces the earlier "`Pending` is never stored"), stores a declined payment as `Failed` and then throws `PAYMENT_DECLINED`; if the gateway throws, the payment stays `Pending` and the error propagates. Both use cases answer `{ orderId, status, amount, currency }`. No route: ordering calls `CHARGE_PAYMENT` and `REFUND_PAYMENT` through the barrel, and `PaymentsModule` is not imported in `AppModule` yet.
- **Routes:** only `PUT` and `GET /stock/:productId`. Reserve, release and commit have no route; ordering reaches them through the barrel in F3. `INSUFFICIENT_STOCK` therefore has no HTTP status.

- **Ordering, process manager (decided — user, 2026-10-08, rules 12 to 16):** the flow, the compensation on `INSUFFICIENT_STOCK` and `PAYMENT_DECLINED`, the events and `paymentMethodToken`. Statuses I chose: `INSUFFICIENT_STOCK` 409, `PAYMENT_DECLINED` 402 (the two codes are the approved ones, added to ordering's `errors.ts`).
- **Ordering rule 17 (decided — user, 2026-10-09):** when `payments.charge` throws something other than a decline, nothing is compensated: the order stays `Placed`, its stock stays reserved, nothing is published and the error propagates (500). Placing a `Placed` order runs the flow again (the only way a `Placed` order is placed again; it overrides rule 10 for that state): reserve returns the held reservation, charge resolves the `Pending` payment with its stored request, then commit and `Paid`, with one charge.
- **Ordering rule 18 (decided — user, 2026-10-09):** inventory's `PRODUCT_NOT_STOCKED` on reserve is treated as `INSUFFICIENT_STOCK` (nothing was reserved). Any other inventory failure propagates and leaves the order `Placed`, as in rule 17.
- **Ordering rule 19 (decided — user, 2026-10-09; supersedes the `Placed` part of rule 8):** a `Placed` order is not cancellable (`ORDER_NOT_CANCELLABLE`), because it may hold stock and a `Pending` or captured charge, and a cancel that arrives while `PlaceOrder` runs finds it `Placed`. Cancelling with a refund stays out of scope.
- **Ordering rule 20 (decided — user, 2026-10-09):** once the charge is captured nothing is compensated. A failed stock commit or a failed save of the `Paid` order propagates and leaves the order `Placed` with its stock reserved, so placing it again finishes the flow (rule 17); a failed publish leaves the order `Paid` and loses the event (rule 15).
- **Ordering rule 21 (decided — user, 2026-10-09):** an `INVALID_AMOUNT` refusal of payments (a total of 0) has a known outcome, nothing charged and nothing stored, so it is treated as a decline (rule 14): the stock is released, the order returns to `Draft` and the command is refused with `PAYMENT_DECLINED`. The alternative is a new ordering code for it, at the cost of one more error code and status.
- **Events (rule 15):** the order is saved first and the event published after, so a failed publish loses the event; the outbox is out of scope.
- **Ports in ordering:** `StockReservation` (`reserve` answers `Reserved` or `OutOfStock`, `release`, `commit`), `Charges` (`charge` answers `Captured` or `Declined`; no refund) and `DomainEvents` (`publish`). The context adapters read the refusal `code`, since the barrels export no error classes; that is smaller than exporting classes only for ordering, and the ACL stays one file per provider.

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
- [x] F2b: fix the F2 review findings (review-ecbc7d7ed25bd7cc; user decision, 2026-10-09). Route: delegated writer. Commits 585f9d3, 5f4ad41, 950ae54, 5bd418d, 004c29e, af041d9, ee0c651, e82f837, ad22fd3 and fac7f70. RED: the idempotency scenarios and gateway spec failed (8 tests), the Pending scenario and the `startCharge` spec failed (6 tests), the explicit declined amount failed 2 scenarios, the gherkin test received two bindings. Checks: `nx run-many -t lint test typecheck` green for 18 projects, `bun test schematics` 339 pass, prettier clean, Stryker payments 100.00. Follow-up (user, 2026-10-09): the idempotency key is the payment id; RED 24 tests.
- [x] F2c: fix the F2b review findings (review-18ec78503f4dcda2; user decision, 2026-10-09). Route: delegated writer. Commits 0fd56a1, dce1c7a and 929a00e. RED: the compare-by-id save failed 2 tests (a `MemoryPayments` spec and the three-charge interleave, which left `P1 Failed` over `P2 Pending`). Checks: `nx run-many -t lint test typecheck` green for 18 projects, prettier clean, Stryker payments 100.00.
- [x] F3: ordering. Update the docs, add the cross-context ports with `kind=context`, the `DomainEvents` port, and the PlaceOrder process manager with compensation, all with TDD. Route: delegated writer. Commits 8c0f815, 1a7d98c, 4b335de, 6dfdfe8, ef760f9, ef137a5, 9d20e69, 8215f29, 5596ea1 and 7afacaf. RED: 13 `Order` domain specs, 1 `MemoryDomainEvents` spec, 12 adapter specs, 20 feature and spec tests before the process manager. Checks: `nx run-many -t lint test typecheck` green for 18 projects, prettier clean, Stryker ordering 100.00.
- [x] F4: Stryker on inventory, payments and ordering. Record the IMPACT rows. Route: delegated writer. Commits 3ea29cc, 40657af, 0b1d39b, e8dcc00, e8fc85f, 9f8a38f, 5532c0e, 9a143df and the closing docs commits. Details in Progress.
  - [x] Docs consistency check (user decision, 2026-10-09; 40657af, docs fixes 3ea29cc). Add a fitness test over `docs/*/domain-model.md` that fails when any of these holds:
    - a rule's text changed since the commit that recorded its Source, unless the Source names a newer `decided — <date>` or `amended <date>`;
    - an `assumed` rule backs a feature scenario not tagged `@draft`, or a `@draft` tag has no `assumed` rule behind it;
    - a status sentence about confirmations disagrees with the Source column (for example, "the user has not confirmed them" while every rule is `decided`).

    Why: during F2 a writer added "the payment keeps none" to an approved rule, and stale "not confirmed" sentences outlived their confirmations three times.

  - [x] External ground truth in the docs phase (user decision, 2026-10-09; 0b1d39b). A driven port to a system we do not own (for example a payment gateway) must cite that system's official docs in its row of the ports table, written when the docs are, before the code. Add it to the schematics skill's docs-first workflow and to AGENTS.md, and make the docs consistency check refuse a non-Memory, non-`@<context>` adapter whose row has no source link.

    Why: the order id as the idempotency key contradicted Stripe's documented replay of declines, and only a review after the code caught it.
- [x] F5: UI. Slices are vertical (user decision, 2026-10-08), so this slice ships its UI. Route: delegated writer (single writer; trigger: 2+ non-trivial files per step). Commits 4a8e396, 5224b61, b1a1693, 155d599, cb06bb9, 525ee83, 9cef14e and 75a04fc (IMPACT). Details in Progress, assumptions in "F5 assumptions", the browser checks in "F5 runtime checklist".
  - [x] Add a payment-token field to Place, which shows `PAYMENT_DECLINED` or `INSUFFICIENT_STOCK` and leaves the order back in Draft (5224b61). A server error during place says the payment result is unknown, reads the order again (it stays `Placed`) and lets the user place it again.
  - [x] Show the `Paid` status; Cancel only for a `Draft`; Place also for a `Placed` order (4a8e396).
  - [x] Add an inventory stock page at `/stock/:productId` (GET and PUT the level) in `libs/web/inventory`, generated with `web-context` (b1a1693, 155d599, cb06bb9, 525ee83, 9cef14e).

## Review follow-ups

On 2026-10-09 the U5 review (754935a..07d9f81, review-88533ca97c6f7b39) and the F1 review (07d9f81..fdb9216, review-77c9c8af12fe259d) were approved and acknowledged. They left these follow-ups:

- [x] F3 (user decision, 2026-10-09; resolved by a test, no code change): `ReserveStock` loads each stock item once, so two lines for the same product make the second save overwrite the first and reserve too little (ReserveStock.ts:28-31). F3 either merges or refuses duplicate lines in `ReserveStock`, or proves with a test that the process manager sends distinct lines. Proved: ordering merges by product (rule 3), and the scenario `a product added twice is reserved as one line` asserts that `reserve` receives one line with the summed quantity.
- [ ] `ReserveStock` reads, modifies and writes `StockItems` with no concurrency control, so a concurrent update can be lost (ReserveStock.ts:24-35). This joins the optimistic concurrency follow-up (out of scope), which must land before a real database adapter.
- [x] F3 (review-18ec78503f4dcda2, user decision, 2026-10-09; ordering rule 17): money captured with a lost answer leaves the payment `Pending`, which cannot be refunded (ChargePayment.ts:27-35). The process manager must not compensate (release the stock and return the order to `Draft`) while the charge outcome is unknown. Done: the process manager lets the error propagate and leaves the order `Placed` with its stock reserved (rule 17, assumed).
- [x] U5 (9f8a38f): a stale command result answers `false` and leaves no trace (order-store.ts:85-86). It is the recorded assumption "a response for another order is ignored and answers `false` without an error", and the two store specs of `a response that lands after another order was opened` cover the `false` and the unchanged order. They did not assert the missing error, so both now assert `commandError()` is `''`. RED by mutation: setting a `STALE` error in the stale branch failed both.
- [x] U5 (9a143df; typecheck target on the web domain libs, see Progress): the `readonly lines` spec only checks types (`@ts-expect-error`) and asserts nothing at runtime (order.spec.ts:29-36). The web libs have no `typecheck` target, so CI never checks it. Add a typecheck target for the web libs, or drop the spec.
- [x] The F2c review (d8726c5..f5b7bb5, review-8c23bd832873c375; done in e8fc85f) was approved and acknowledged on 2026-10-09. It found only test-quality and wording issues, so they wait for F4, the payments Stryker and hardening pass:
  - [x] `ChargePaymentOverlap.spec.ts`: it is coupled to microtask order (42-43), it settles on any rejection (28-32), and a release can go unnoticed (17).
  - [x] `world.ts:29-34` still swallows the guard path.
  - [x] `MemoryPaymentGateway`: the `GatewayError` doc is missing (23-24), and its spec mixes assertions and checks the error type only partly (43-45).
  - [x] `Payments.ts:5`: the atomicity of `save` is not stated in the port contract.
  - [x] `MemoryPayments.spec.ts:34`: the describe name.
- [x] The F3 review covered the whole range, 6096239..307690f (review-3dd4d850cd5b0202). It was approved after one bounded correction (65d1f04) and acknowledged on 2026-10-09. The CRITICAL finding: a retry finds the order `Placed` while the run it retries is still going, so two placements of one order overlapped, which could publish `OrderPaid` twice or leave a `Paid` order with uncommitted stock. `PlaceOrder` now queues the runs of one order. RED: the new spec saw both placements end `Paid`. The queue holds within one API instance only; the optimistic concurrency follow-up still owns the multi-instance case.
  - Two earlier slices of the same range, ending at 6dfdfe8 and at ef760f9, were abandoned with the user's authorization (review-d6d28ca6aa8a19e1, review-2402ed155851f82a). Each cut landed between a domain change and the application code that uses it, so the review flagged the intermediate state.
  - Lesson for writers: a domain change that activates behaviour lands in the same commit as the application code that uses it.
- [ ] Follow-ups from the F3 reviews (review-70b0f8a5ccc4ca4f and review-3dd4d850cd5b0202), for F4. All done in e8dcc00 except the first, which stays open on purpose:
  - [ ] `CancelOrder.ts:26` can lose an update against a concurrent placement. Not fixed (user decision, 2026-10-09): it belongs with the optimistic concurrency follow-up, which must land before a real database adapter. Rule 19 already refuses to cancel a `Placed` order, so only the read-then-save window remains.
  - [x] `PaymentsCharges.ts:28-30`: a deterministic payments refusal other than a decline (for example `INVALID_AMOUNT`) is treated as an unknown outcome, so the order stays `Placed`.
  - [x] `PlaceOrder.steps.ts:23-35`: a Given does not assert the precondition it sets up.
  - [x] `PlaceOrder.spec.ts`: no test covers a failure after the capture (commit or save failing).
  - [x] `PlaceOrder.ts:59`: the event id comes from the raw command.
- [ ] Follow-ups from the F4 review (4dac8a8..3b99bda, review-89ea10a06e10674b, approved and acknowledged on 2026-10-09):
  - `docs.fitness.test.ts:218-230` reads git history, so a shallow clone breaks it or makes it vacuous. CI checks out with `fetch-depth: 0`, so CI is safe today; a local shallow clone is not. Fail with a clear message when the history is shallow.
  - `docs-consistency.ts`:
    - a redundant link regex (157);
    - a Memory fake of an external system is exempt from the source link (152-159);
    - unnumbered rules carry over (67-86).
  - The Progress entry at line 215 still calls rules 20 and 21 assumed.
  - Minor: an unexplained padded id (`PlaceOrder.spec.ts:133`) and an unchecked word parameter (`Placement.steps.ts:23`).

## F5 assumptions

Product decisions the docs leave open for the UI, each the simplest option.

- **Where the token lives.** The payment-token field sits with the actions in `OrderActions`, as a Signal Forms form: Place is its submit button, so Enter in the field places. Label "Payment token", hint "Use tok_decline to get a declined payment; any other token is captured." The field is required and trimmed ("Enter a payment token." after a refused submit, which also focuses it). It is disabled when Place is not allowed, stays filled after a refusal and is never cleared.
- **Copy of the new messages.**
  - `PAYMENT_DECLINED`: "The payment was declined and nothing was charged. The order is a draft again; try another payment token."
  - `INSUFFICIENT_STOCK`: "There is not enough stock for this order. It is a draft again; change the quantities and place it again."
  - Unknown outcome: "We could not confirm the payment, so the payment result is unknown. The order is still placed, and placing the order again is safe."
  - Success notice: "Order paid."
- **Unknown outcome is a 500.** A 5xx without a refusal code becomes the client code `SERVER_ERROR` ("The server failed to complete the request. Try again."); during Place the store turns it into `PAYMENT_OUTCOME_UNKNOWN` and reads the order again. A lost connection (`NETWORK_ERROR`) during Place is not treated as unknown, although the server may have charged: the brief names the 500 only.
- **A refusal is not reloaded.** After a 402 or 409 the server and the page both hold a `Draft`, so the page keeps its copy and shows the message.
- **`PRODUCT_NOT_STOCKED` on place.** The API answers `INSUFFICIENT_STOCK` (409) for it, because ordering treats it as such (rule 18), so ordering has no message for it; the code is only an inventory one.
- **Actions by status.** Add line stays `Draft` only (rule 4), Place is `Draft` or `Placed` with at least one line (rules 10 and 17), Cancel is `Draft` only (rule 19). A `Paid` order has everything closed.
- **Stock page.** `/stock/:productId` is mounted by `loadComponent` in `apps/web` (no routes file, one route). The shell has no nav, so no link was added and the page is reached by URL; there is no product picker (no catalog API).
- **Stock form.** Label "Units on hand", starts at 0, hint "A whole number of 0 or more, not below the units already reserved.", button "Set level". The client checks only the integer of 0 or more; a level below the reserved count is left to the server (422 `STOCK_LEVEL_INVALID`, message names both rules). Success notice: "Stock level set."
- **Not stocked yet.** A 404 on the read shows "This product is not stocked yet. Set a level to start stocking it." in the alert region and no summary; the form stays enabled because a PUT creates the record (rule 7).
- **Summary.** On hand, reserved and available (`onHand - reserved`), with no refresh: the page shows the level at load and after the last PUT, so reservations made by orders appear on reload.
- **One command at a time**, the same rules as the order store: a second command shows `COMMAND_IN_PROGRESS`, and a response that lands after another product was opened is dropped.
- **Duplicated helpers.** `errorCodeOf` and `messageFor` exist in both web contexts, since a web context may not import another (IMPACT row).

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
  - Follow-up 2 (ad22fd3, fac7f70; user decision, 2026-10-09: store the token): the `Pending` payment keeps the opaque `paymentMethodToken` and the amount of its request (rule 5 no longer says the payment keeps none). `ChargePayment` always sends `started`'s amount, currency and token under `started.id`, so a retry resolves with the stored request and the retry's own token and amount are not used; the fake's same-key/different-params refusal stays as a guard against a programming error. A `Failed` outcome is replaced by the next charge with the retry's request and a new key. RED: 4 tests failed (retry with another token and amount resolves with the first request, a pending payment declined with its stored token fails and the next charge uses a new key, `Payment` keeps its token). Checks: lint, test and typecheck green for 18 projects, tsc on both payments tsconfigs, prettier clean; Stryker `--concurrency 3` total 100.00, payments 100.00 (36 killed, 17 timeouts under load, 0 survived).
  - Checks: `nx run-many -t lint test typecheck` green for 18 projects; `nx test api-payments` 57 tests, 95.65% statements, 100% branches and functions; `bun test schematics` 339 pass; prettier clean. Stryker (`--concurrency 3`): total 100.00, payments 100.00 (46 killed, 7 timeouts, 0 survived), break 90.
- 2026-10-09: F2c done in 0fd56a1, dce1c7a and 929a00e. Route: delegated writer. TDD strict, runner `bunx nx test api-payments`.
  - Late save (docs 0fd56a1, code dce1c7a): rule 15 (decided — user, 2026-10-09 (F2c)): `Payments.save` stores a payment unless the order holds one with another id, which keeps the port to one method. `ChargePaymentOverlap.spec.ts` interleaves A and B sharing P1, A declined, C creating P2, then B's late decline; it sits in `infrastructure/` because application specs may not import an adapter. RED: that spec found `P1 Failed` over `P2 Pending`, and the `MemoryPayments` spec saw the stored payment replaced by another id.
  - Minor findings (929a00e): the steps keep only `PaymentsError` and a named `GatewayError` (the fake's refusal and the timeout), anything else fails the step; the count step is now `the number of charges the gateway has captured is N`; the gateway spec uses payment keys; the glossary says an order has one payment at a time; the `Payment` spec name mentions the token. RED: the gateway spec failed on the missing `GatewayError`.
  - Recorded only: the F3 follow-up for a lost-answer charge that leaves a `Pending` payment (review follow-ups).
  - Checks: lint, test and typecheck green for 18 projects, tsc on both payments tsconfigs, prettier clean; Stryker `--concurrency 3` total 100.00, payments 100.00 (39 killed, 14 timeouts under load, 0 survived).

- 2026-10-09: F3 done in 8c0f815, 1a7d98c, 4b335de, 6dfdfe8, ef760f9, ef137a5, 9d20e69, 8215f29, 5596ea1 and 7afacaf. Route: delegated writer. TDD strict, runner `bunx nx test api-ordering` (and `api`).
  - Docs (8c0f815, 4b335de, ef137a5): rules 12 to 19, the Placed, Paid states, the three ports, flows, glossary and the features. The native review of the docs raised six findings, settled in 4b335de: a `Placed` order is not cancellable (assumed rule 19, which also ends the cancel-during-placement race and the leak of stock or a charge), decided rules no longer lean on assumed ones (rules 8 and 10 keep their text and name the exception), a retry after a decline charges again (payments rule 7; stated in rule 14 and the `Charges` contract), the lost event after save is stated in rule 15, and the refused-cancel scenario asserts the order is unchanged.
  - Generation (1a7d98c): `hex-driven-port` x3 (`StockReservation` from `@inventory`, `Charges` from `@payments`, `DomainEvents` from `Memory`); no refusal, the lint edges already existed. Misses: the context adapter template (empty class, type-only import), `hex-slice` (no new codes), `hex-use-case` and `hex-route` (no refresh of an existing use case or body), and no test doubles for a context port (see IMPACT).
  - Domain (6dfdfe8): `Order` gains `Paid`, `pay`, `reopen`, `total`; `place` accepts a `Placed` order; `cancel` accepts only `Draft`. RED: 13 specs failing, then 35.
  - Adapters (ef760f9): `MemoryDomainEvents` (RED `publish is not a function`), `InventoryStockReservation` and `PaymentsCharges` with the refusal `code` read structurally (RED: 12 failing).
  - Process manager (9d20e69): the feature steps and fakes (`steps/fakes.ts`) went first and 20 tests failed; `PlaceOrder` and `CancelOrder` then passed them; the call-order specs in `PlaceOrder.spec.ts` were written after. `api-ordering` 144 tests, 95.96% statements, 100% branches and functions.
  - Wire (8215f29, 7afacaf): `OrderingModule` imports `InventoryModule` and `PaymentsModule`, the place body takes `paymentMethodToken` (RED by loosening the schema: the 400 spec failed), and the filter maps 409 and 402. The HTTP spec covers pay, `tok_decline` (402, back to Draft, placed again), no stock (409), cancel of a paid order (409) and the 400 body. A pre-existing flaky assertion (`not.toContain('c-1')` on a body holding a random UUID) failed Stryker's dry run and was narrowed to the lines.
  - Checks: `nx run-many -t lint test typecheck` green for 18 projects, tsc on the ordering lib and spec tsconfigs and the api tsconfigs, prettier clean. Stryker (`--concurrency 3`): total 100.00, inventory 100.00, ordering 100.00 (157 killed, 5 timeouts, 0 survived), payments 100.00; break 90.

- 2026-10-09: F4 done in 3ea29cc, 40657af, 0b1d39b, e8dcc00, e8fc85f, 9f8a38f, 5532c0e, 9a143df and the closing docs commits. Route: delegated writer (one writer, 2+ non-trivial files per item). TDD strict, runners `bun test schematics`, `bunx nx test api-ordering`, `api-payments` and `web-ordering-data-access`.
  - Docs consistency check (40657af): `schematics/_shared/docs-consistency.ts` holds four pure checks and `docs.fitness.test.ts` runs them on fixtures and on the real docs, with a floor (more than 40 rules, 100 scenarios and 5 ports). RED: with stubs, 7 of the 22 tests failed (stale Source, three scenario cases, three status cases, the unsourced port). On the real docs it then failed with six rules whose text changed after their Source (payments 2, 12, 13, 14; ordering 10, 11) and one stale sentence (ordering rules 17 to 19 "wait for the user to confirm them"). The docs were fixed (3ea29cc, and the sentence in e8dcc00), the test was not weakened. Planted RED on the real docs: editing payments rule 1 failed it with `rule 1`. Limits: a rule is followed by its number, so a renumbering looks like a new rule; the Source must change in the same or a later commit than the text (a Source that already named that date does not excuse an edit); only the `Business rules` prose of each `domain-model.md` is read for status sentences, not READMEs or glossaries.
  - External ground truth (0b1d39b): AGENTS.md (Working rules) and the schematics skill (docs-first step 2) carry the rule; the check refuses an adapter cell that is neither `Memory` nor `@<context>` when its row has no link (the generator already refuses such a cell, so the docs check adds the link requirement); payments' `PaymentGateway` row cites https://docs.stripe.com/api/idempotent_requests, with a test that pins it (RED with the URL replaced). The page was fetched and confirms the semantics the fake copies: the first result is saved for a key whether it succeeds or fails and replayed, and a request whose parameters differ errors.
  - Typecheck for the web libs (9a143df): only `@demo/api` had a `typecheck` target (inferred by `@nx/rsbuild`); no lib had one. The two plain-TypeScript web domain libs got an explicit `nx:run-commands` target (`tsc --noEmit` over `tsconfig.lib.json` and `tsconfig.spec.json`), and the `web-context` domain template emits it (RED: the factory test failed on the old project). `nx run-many -t typecheck` now runs 3 projects. RED for the spec: making `Order.lines` mutable made `web-ordering-domain:typecheck` fail with TS2578. The Angular web libs and the api libs have no target: `tsc -p` fails on the Angular tsconfigs (`rootDir`, `inlineSources`), so they stay covered by the Angular builder and by the tsc runs of the writers.
  - Ordering follow-ups (e8dcc00, docs first): new rules 20 and 21 are `assumed` with `@draft` scenarios (see below). RED: 5 tests (the three scenarios, the event id spec, the `INVALID_AMOUNT` adapter spec). The three specs for a failure after the capture (commit, save of the paid order, publish) passed on arrival: they pin the existing behaviour. The Given steps now assert their preconditions; RED by making the fake ignore `giveNoAnswerOnce`, which failed three scenarios on the Given (it was silent before).
  - Payments test quality (e8fc85f): the overlap spec waits on `asked(n)` instead of a microtask, settles only on a `PAYMENT_DECLINED`, and throws on a release nobody asked for; the world keeps only `PaymentsError` and its own `timeout`, so the fake's guard fails the step; the `GatewayError` doc and the spec asserts are uniform; the atomicity of `save` is in the port and the docs contract; the describe is `save compares the payment id`. RED by mutation: the guard comparison made six scenarios fail with its message, and removing the compare-by-id in `MemoryPayments.save` failed the overlap spec and its contract spec.
  - Steps index (5532c0e): `catalog`, `notifications`, `ordering` and `shipping` (also stale) now equal the current template output (the same file as inventory's and payments'); `nx run-many -t test -p api-ordering,api-catalog,api-notifications,api-shipping` green.
  - Stryker (`bunx stryker run --concurrency 3`, 8 min 16 s): total 98.03; inventory 100.00, payments 100.00, ordering 96.51 (162 killed, 4 timeouts, 6 survived). The six survivors are the map cleanup of the placement queue in `PlaceOrder.ts` (lines 75 to 78, from 65d1f04): nothing observable depends on `running` being emptied, so they are left. The gate (break 90) passes.
  - IMPACT: one use row (slice 2 summary), two defect rows (the web typecheck target; the docs fitness test), no miss.
- 2026-10-09: F5 done in 4a8e396, 5224b61, b1a1693, 155d599, cb06bb9, 525ee83, 9cef14e and 75a04fc. Route: delegated writer (single writer; each step writes 2+ non-trivial files). TDD strict, source the user's global configuration, runner `bunx nx test <project>` (Angular unit-test builder, vitest + jsdom) and `bun test schematics`. The Engram mirror `odd/order-fulfilment-slice-2/tasks` was not updated by the writer.
  - Paid status (4a8e396): `OrderStatus` gains `Paid`; `canPlace` allows `Placed` with lines (rule 17) and `canCancel` is `Draft` only (rule 19). RED: 2 domain specs (place a `Placed` order, cancel a `Placed` one); the page spec for an order left `Placed` also failed against the old domain (1 test).
  - Place with a token (5224b61), one commit across the four layers because the store signature changes with the UI. RED, in order: data-access compile errors (`place` took 0 arguments, TS2554) and a failing `errorCodeOf` spec; 4 domain message specs; 5 `OrderActions` specs (token field, hint, trim, blank refusal, disabled); the page compile error and 8 page specs. `OrderStore.place(token)` sends `{ paymentMethodToken }`; a `SERVER_ERROR` becomes `PAYMENT_OUTCOME_UNKNOWN` and triggers `resource.reload()`. `OrderActions` was edited by hand (no schematic edits an existing component). The `checkout-cta` spec (`control` and `b` labels) passes unchanged.
  - Inventory context (b1a1693): `web-context --context=inventory`, 26 files in one pass, the four libs and the aliases; lint, test and typecheck pass on the empty libs.
  - Domain (155d599): `StockLevel`, `availableOf`, `isOnHand`, `messageFor`. RED: both suites failed on a missing module; 16 tests.
  - Data-access (cb06bb9): `ng-service` for `InventoryApi` and `StockStore` (fields `productId`, `busy`, `commandError`), `errorCodeOf` by hand. RED: compile errors (`setLevel`, `stock`, `open`, `level` missing, `./error-code` unresolved), then 4 failing store tests; the fixes were in my own specs (a read error persists until the PUT answers) and in the store (clear the command error on success).
  - UI (525ee83): `ng-component` for `stock-summary` and `stock-level-form`. RED: 10 specs failed against the generated stubs.
  - Feature and route (9cef14e): `ng-component` for `stock-page`, wired as `stock/:productId` in `apps/web`. RED: 10 page specs failed against the stub, then 2 app specs (the stock page and its AXE check) before the route. Every ui and feature spec asserts no AXE violations.
  - Context map: unchanged. `web-inventory-*` imports only itself and `context:shared`; a throwaway import of `web-ordering-domain` from `web-inventory-domain` is rejected by `@nx/enforce-module-boundaries`. The reverse is not rejected: `contextRelations` (`ordering -> inventory`, declared for the API) also lets the web ordering libs import the web inventory libs. Nothing imports across the two web contexts; making the web side stricter needs a scoped map (IMPACT row).
  - Schematics used: `web-context` (1), `ng-service` (2), `ng-component` (3), `ng-directive` (none needed). No schematic changed. IMPACT rows: 3 use, 3 miss and 1 defect. `ng-component` evidence: 74 lines generated in 12 files against 609 final lines (12%); 56 of the 74 survive; every template, stylesheet and spec body was rewritten, and the Signal Forms model, computed members and param subscription are hand-written. It saves the naming and wiring convention (about 2-3 minutes per component), not code.
  - Checks: `bunx nx run-many -t lint test typecheck` green for 22 projects; `bun test schematics` 362 pass; `bunx prettier --check .` clean. Not run: Stryker (no api code changed), builds and boots.

## F5 runtime checklist (for the user, in the browser)

Start with `bun run dev --detach`, read the web URL from `bun run dev:status` and open it at `localhost`. The API seeds `keyboard`, `mouse` and `monitor` with 50 units each.

1. Pay: `/` creates an order; add `keyboard` x1, type any token (for example `tok_visa`) and Place. The status becomes `Paid`, the notice says "Order paid.", and Add, Place, Cancel and the token field are disabled.
2. Declined: on a new order with a line, place with `tok_decline`. The alert shows the declined message, the status stays `Draft`, the token field keeps its text, and Place and Cancel are enabled. Replace the token with `tok_visa` and Place again: `Paid`.
3. No stock: on a new order add `keyboard` x60 (stock is 50) and place. The alert shows the stock message and the order is a `Draft`. Lower the quantity to 1, or raise the level on `/stock/keyboard`, and place again.
4. Paid is not cancellable: after step 1 the Cancel button is disabled; `POST /api/orders/<id>/cancel` from the Network tab or `curl` answers 409 `ORDER_NOT_CANCELLABLE`. A `Draft` can still be cancelled.
5. Unknown outcome (optional, needs the API to throw): the page shows the unknown-payment message, the order reads as `Placed` after a reload, Place is enabled and Cancel is not.
6. Blank token: press Place with the field empty; the page shows "Enter a payment token.", sends nothing and focuses the field. Enter in the field places.
7. Stock page, GET: open `/stock/keyboard` (on hand 50, reserved 0, available 50). Place an order for it and reload: reserved changes while the order is `Placed`, and on hand and reserved drop after `Paid`. Open `/stock/ghost`: the alert says it is not stocked yet and no summary shows.
8. Stock page, PUT: set `7` on `keyboard` ("Stock level set.", the summary updates). Set `-1` or `1.5` (client message, no request). With reserved units held, set a level below the reserved count (422 message). Set `5` on `/stock/ghost`: it creates the record (rule 7) and the not-stocked alert clears.
9. Network tab: calls are `/api/stock/<id>` (GET, PUT with `{ "onHand": n }`) and `/api/orders/<id>/place` (body `{ "paymentMethodToken": ... }`) on the web origin, with no `OPTIONS` and no 403.
10. A/B and theme: `?exp=checkout-cta:b` shows "Place order securely", `control` shows "Place order"; `?exp=theme:b` switches to `stripe`. Check the focus ring on the token and stock inputs, and the error borders, in both themes.
11. AXE in the browser (extension or Lighthouse) on an order with the token field (empty, error showing, disabled after Paid) and on `/stock/keyboard` (idle, error, not stocked), in both themes. Colour contrast is only checked here; the `stripe` theme is known to miss AA for `danger` and `muted` text.
12. Keyboard: Tab through the token field, Place, Cancel, and the stock field and Set level; Enter submits both forms; a refused submit moves focus to the field.

## Next step

F5 is done and the slice has all its tasks; the user runs the F5 runtime checklist in the browser. Open follow-ups: the F4 review items, the optimistic concurrency follow-up (`CancelOrder.ts:26`, `ReserveStock`) that must land before a real database adapter, a web-scoped context map (IMPACT), and treating a lost connection during Place as an unknown outcome if the user wants it.
