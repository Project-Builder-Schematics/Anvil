# Inventory — domain model

The single subdomain of [Inventory](README.md). Terms are in the [glossary](glossary.md); sequence diagrams are in [flows.md](flows.md). Each business rule becomes a `Rule:` in a feature next to this file.

## Aggregates

| Aggregate     | Root entity   | Invariants it protects                                                                                                                                                                       | Changed by                                                     |
| ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `StockItem`   | `StockItem`   | The level is an integer of 0 or more (6) and never below what is reserved (11). A reservation takes stock only when enough is available (1). Release returns it (3). Commit consumes it (4). | `ReserveStock`, `ReleaseStock`, `CommitStock`, `SetStockLevel` |
| `Reservation` | `Reservation` | One per order (2, 8). Held until it is released or committed, then final (3, 9). It records what the order reserved so that release and commit move exactly those quantities.                | `ReserveStock`, `ReleaseStock`, `CommitStock`                  |

## Entities

| Entity        | Identity                     | Attributes                                          | Inside aggregate | Lifecycle                                                                          |
| ------------- | ---------------------------- | --------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `StockItem`   | `ProductId`, one per product | `productId`, `onHand`, `reserved`                   | `StockItem`      | Created by the first `SetStockLevel` of a product, or seeded. It is never removed. |
| `Reservation` | `OrderId`, one per order     | `orderId`, `lines` (product and quantity), `status` | `Reservation`    | `Held` → `Released` or `Committed`. Both are final.                                |

## Value objects

| Value object | Attributes        | Validation                                                    | Used by     |
| ------------ | ----------------- | ------------------------------------------------------------- | ----------- |
| `StockLevel` | `value` (integer) | An integer of 0 or more, else `STOCK_LEVEL_INVALID` (rule 6). | `StockItem` |

## Business rules

Numbered; every validation cites one; state precedence when several can hold; `<` vs `<=` spelled. `Source` is `decided[ — <reason>]` or `assumed`, and an `assumed` rule may only back a `@draft` feature. Error codes are CAPS tokens in backticks.

Rules 1 to 6 were approved by the user on 2026-10-08. Rules 7 to 11 fill gaps the approved rules leave open; the simplest reading was taken and the user confirmed them on 2026-10-09.

| #   | Rule                                                                                                                                                                                                                            | Source  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | A reservation is all-or-nothing. Every line needs `available >= quantity`, where `available = onHand - reserved`. When any line falls short the whole reservation is refused with `INSUFFICIENT_STOCK` and nothing is reserved. | decided |
| 2   | There is one reservation per order. Reserving again for the same order returns the existing reservation and reserves nothing more, whatever lines the new request carries.                                                      | decided |
| 3   | Releasing a reservation returns its quantities to `available`. Releasing an unknown or already released reservation changes nothing and is not an error.                                                                        | decided |
| 4   | Committing a reservation decrements both `onHand` and `reserved` by its quantities.                                                                                                                                             | decided |
| 5   | A product with no stock record is refused with `PRODUCT_NOT_STOCKED`, whether it is reserved or read.                                                                                                                           | decided |
| 6   | The stock level is an integer of 0 or more; any other value is refused with `STOCK_LEVEL_INVALID`. Setting it leaves `reserved` as it is.                                                                                       | decided |
| 7   | Setting the level of a product with no stock record creates the record, with nothing reserved.                                                                                                                                  | decided |
| 8   | A released reservation no longer counts as the order's reservation: reserving again for that order creates a new one.                                                                                                           | decided |
| 9   | Only a held reservation can be released or committed. Committing an unknown, released or already committed reservation changes nothing and is not an error, and neither is releasing a committed one.                           | decided |
| 10  | When a reservation has several refusals, `PRODUCT_NOT_STOCKED` for any of its lines wins over `INSUFFICIENT_STOCK`.                                                                                                             | decided |
| 11  | A level below the reserved count is refused with `STOCK_LEVEL_INVALID`, so `reserved <= onHand` always holds and `available` is never negative.                                                                                 | decided |

## Use cases

One row per use case; `Feature` links the `.feature` written next to this file before the code is generated.

| Use case        | Command                                         | Result                                          | Driven ports                 | Feature                                            |
| --------------- | ----------------------------------------------- | ----------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| `ReserveStock`  | `{ orderId, lines: { productId, quantity }[] }` | `{ orderId, lines: { productId, quantity }[] }` | `StockItems`, `Reservations` | [reserve-stock.feature](reserve-stock.feature)     |
| `ReleaseStock`  | `{ orderId }`                                   | `{}`                                            | `StockItems`, `Reservations` | [release-stock.feature](release-stock.feature)     |
| `CommitStock`   | `{ orderId }`                                   | `{}`                                            | `StockItems`, `Reservations` | [commit-stock.feature](commit-stock.feature)       |
| `SetStockLevel` | `{ productId, onHand }`                         | `{ productId, onHand, reserved }`               | `StockItems`                 | [set-stock-level.feature](set-stock-level.feature) |
| `GetStockLevel` | `{ productId }`                                 | `{ productId, onHand, reserved }`               | `StockItems`                 | [get-stock-level.feature](get-stock-level.feature) |

`ReserveStock`, `ReleaseStock` and `CommitStock` have no route: ordering calls them through this context's barrel.

## Driven ports

`Adapter today` starts with `Memory` or `@<context>` (another context's barrel). `Contract` is the invariant every implementation keeps, in-memory or real.

| Port           | Answers                                                         | Adapter today                                                                | Contract                                                                                          |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `StockItems`   | `byId(productId) → StockItem \| null`, `save(item)`             | Memory: a process-local map, lost on restart, seeded with the demo products. | `byId` returns what `save` last stored under that product and `null` for a product never saved.   |
| `Reservations` | `byOrderId(orderId) → Reservation \| null`, `save(reservation)` | Memory: a process-local map, lost on restart.                                | `byOrderId` returns what `save` last stored under that order and `null` for an order never saved. |

## Driving adapters

`Route` is `METHOD /<resource>[/path]` under the API's global prefix. `Answers` lists the statuses; the first 2xx is the success status. `Caller` is who may call and where the identity comes from; request bodies never carry `userId`, `accountId` or `actorId`.

400 is the Zod body check (a number where a number is due). Everything else is a rule: 404 for rule 5, 422 for the value refusals of rules 6 and 11.

| Route                   | Use case        | Answers                     | Caller               |
| ----------------------- | --------------- | --------------------------- | -------------------- |
| `PUT /stock/:productId` | `SetStockLevel` | 200 · 400 · 422 rules 6, 11 | public — no auth yet |
| `GET /stock/:productId` | `GetStockLevel` | 200 · 404 rule 5            | public — no auth yet |
