# Payments — domain model

The single subdomain of [Payments](README.md). Terms are in the [glossary](glossary.md); sequence diagrams are in [flows.md](flows.md). Each business rule becomes a `Rule:` in a feature next to this file.

## Aggregates

| Aggregate | Root entity | Invariants it protects                                                                                                                           | Changed by                       |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `Payment` | `Payment`   | One payment per order (2, 7). Its amount is greater than 0 (1, 6). It is captured, failed or refunded from `Pending` and nowhere else (3, 4, 8). | `ChargePayment`, `RefundPayment` |

## Entities

| Entity    | Identity                 | Attributes                                | Inside aggregate | Lifecycle                                                                                                                                                                                       |
| --------- | ------------------------ | ----------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Payment` | `OrderId`, one per order | `orderId`, `amount`, `currency`, `status` | `Payment`        | `Pending` → `Captured` or `Failed`; `Captured` → `Refunded`. A `Failed` payment is replaced by the next charge of its order (7). `Pending` lasts while the gateway answers and is never stored. |

## Value objects

| Value object | Attributes                     | Validation                                                         | Used by   |
| ------------ | ------------------------------ | ------------------------------------------------------------------ | --------- |
| `Amount`     | `value` (integer, minor units) | Greater than 0 and an integer, else `INVALID_AMOUNT` (rules 1, 6). | `Payment` |

## Business rules

Numbered; every validation cites one; state precedence when several can hold; `<` vs `<=` spelled. `Source` is `decided[ — <reason>]` or `assumed`, and an `assumed` rule may only back a `@draft` feature. Error codes are CAPS tokens in backticks.

Rules 1 to 5 were approved by the user on 2026-10-08. Rules 6 to 11 fill gaps the approved rules leave open; the simplest reading was taken and the user has not confirmed them.

| #   | Rule                                                                                                                                                                                                                               | Source  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | The amount is greater than 0 (`amount > 0`). Zero and negative amounts are refused with `INVALID_AMOUNT` and nothing is stored.                                                                                                    | decided |
| 2   | There is one successful charge per order, with the order id as the idempotency key. Charging an order that already has one returns the existing charge and charges nothing more, whatever amount or token the new request carries. | decided |
| 3   | When the gateway declines the charge, the payment is stored as `Failed` and the charge is refused with `PAYMENT_DECLINED`.                                                                                                         | decided |
| 4   | Only a `Captured` payment can be refunded; refunding any other payment is refused with `PAYMENT_NOT_REFUNDABLE`.                                                                                                                   | decided |
| 5   | A charge takes an opaque `paymentMethodToken` and never card data. The gateway receives the token; the payment keeps none. The fake gateway declines `tok_decline` and captures any other token.                                   | decided |
| 6   | The amount is an integer in minor units; a fractional amount is refused with `INVALID_AMOUNT`.                                                                                                                                     | assumed |
| 7   | Only a `Captured` or `Refunded` payment counts as the order's successful charge (rule 2). Charging an order whose payment is `Failed` charges again and replaces the failed payment, so the customer can retry.                    | assumed |
| 8   | Refunding an order that has no payment is refused with `PAYMENT_NOT_REFUNDABLE`, like a payment that is not `Captured` (rule 4).                                                                                                   | assumed |
| 9   | A refund changes the payment only; the gateway has no refund operation in this slice.                                                                                                                                              | assumed |
| 10  | When several refusals hold, `INVALID_AMOUNT` wins: the amount is checked before an existing payment is looked up, so an invalid amount is refused even when the order is already charged.                                          | assumed |
| 11  | The currency is carried as the caller gives it and not re-checked; ordering guarantees three uppercase letters.                                                                                                                    | assumed |

## Use cases

One row per use case; `Feature` links the `.feature` written next to this file before the code is generated.

| Use case        | Command                                             | Result                                  | Driven ports                 | Feature                                          |
| --------------- | --------------------------------------------------- | --------------------------------------- | ---------------------------- | ------------------------------------------------ |
| `ChargePayment` | `{ orderId, amount, currency, paymentMethodToken }` | `{ orderId, status, amount, currency }` | `Payments`, `PaymentGateway` | [charge-payment.feature](charge-payment.feature) |
| `RefundPayment` | `{ orderId }`                                       | `{ orderId, status, amount, currency }` | `Payments`                   | [refund-payment.feature](refund-payment.feature) |

## Driven ports

`Adapter today` starts with `Memory` or `@<context>` (another context's barrel). `Contract` is the invariant every implementation keeps, in-memory or real.

| Port             | Answers                                                                       | Adapter today                                                                                                                                 | Contract                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Payments`       | `byOrderId(orderId) → Payment \| null`, `save(payment)`                       | Memory: a process-local map, lost on restart.                                                                                                 | `byOrderId` returns what `save` last stored under that order and `null` for an order never saved.                 |
| `PaymentGateway` | `charge({ amount, currency, paymentMethodToken }) → 'Captured' \| 'Declined'` | Memory: a fake gateway that declines `tok_decline` and captures any other token; it translates the gateway's own result at the adapter (ACL). | The answer is one of the two domain outcomes. A gateway type never crosses the port, and the token is never kept. |

## Driving adapters

`Route` is `METHOD /<resource>[/path]` under the API's global prefix. `Answers` lists the statuses; the first 2xx is the success status. `Caller` is who may call and where the identity comes from; request bodies never carry `userId`, `accountId` or `actorId`.

| Route | Use case | Answers | Caller |
| ----- | -------- | ------- | ------ |

`ChargePayment` and `RefundPayment` have no route: ordering calls them through this context's barrel.
