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

- [ ] F1: inventory docs and generation, then domain and use cases with TDD. Route: delegated writer.
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

## Next step

F1, after the schematics round lands.
