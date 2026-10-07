# Shipping — domain model

The single subdomain of [Shipping](README.md). Terms are in the [glossary](glossary.md); sequence diagrams are in [flows.md](flows.md). Each business rule becomes a `Rule:` in a feature next to this file.

## Aggregates

| Aggregate | Root entity | Invariants it protects | Changed by |
| --------- | ----------- | ---------------------- | ---------- |

## Entities

| Entity | Identity | Attributes | Inside aggregate | Lifecycle |
| ------ | -------- | ---------- | ---------------- | --------- |

## Value objects

| Value object | Attributes | Validation | Used by |
| ------------ | ---------- | ---------- | ------- |

## Business rules

Numbered; every validation cites one; state precedence when several can hold; `<` vs `<=` spelled. `Source` is `decided[ — <reason>]` or `assumed`, and an `assumed` rule may only back a `@draft` feature. Error codes are CAPS tokens in backticks.

| #   | Rule | Source |
| --- | ---- | ------ |

## Use cases

One row per use case; `Feature` links the `.feature` written next to this file before the code is generated.

| Use case | Command | Result | Driven ports | Feature |
| -------- | ------- | ------ | ------------ | ------- |

## Driven ports

`Adapter today` starts with `Memory` or `@<context>` (another context's barrel). `Contract` is the invariant every implementation keeps, in-memory or real.

| Port | Answers | Adapter today | Contract |
| ---- | ------- | ------------- | -------- |

## Driving adapters

`Route` is `METHOD /<resource>[/path]` under the API's global prefix. `Answers` lists the statuses; the first 2xx is the success status. `Caller` is who may call and where the identity comes from; request bodies never carry `userId`, `accountId` or `actorId`.

| Route | Use case | Answers | Caller |
| ----- | -------- | ------- | ------ |
