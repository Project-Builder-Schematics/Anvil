# Ordering

## Classification

| Axis               | Value  | What it decides                                                   |
| ------------------ | ------ | ----------------------------------------------------------------- |
| Subdomain class    | core   | design investment                                                 |
| Criticality        | high   | verification rigor                                                |
| Volatility         | high   | how much cleanup is worth                                         |
| Architecture level | strict | derived: strict when the class is core or the criticality is high |

## Context map

The contexts this one depends on, each through its public barrel only. A dependency not listed here is refused by the schematics and by the lint boundaries. Relationship is `customer-supplier`, `conformist` or `acl`.

| Depends on | Relationship      |
| ---------- | ----------------- |
| catalog    | customer-supplier |
| inventory  | customer-supplier |
| payments   | acl               |

## Architecture level: strict

Use cases receive their driven ports (`make<UseCase>(ports)`) and are wired in the slice's `composition.ts` with `useFactory`/`inject`. `application/` and `domain/` import no infrastructure and no framework. Rules are pure functions, tested without a database.
