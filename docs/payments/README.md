# Payments

## Classification

| Axis               | Value   | What it decides                                                   |
| ------------------ | ------- | ----------------------------------------------------------------- |
| Subdomain class    | generic | design investment                                                 |
| Criticality        | high    | verification rigor                                                |
| Volatility         | low     | how much cleanup is worth                                         |
| Architecture level | strict  | derived: strict when the class is core or the criticality is high |

## Subdomains

One slice of code per row; docs mirror the code, so a context with several subdomains keeps one folder per subdomain.

| Subdomain                   | Responsibility                                        |
| --------------------------- | ----------------------------------------------------- |
| [payments](domain-model.md) | Authorizes, captures and refunds payments for orders. |

## Context map

The contexts this one depends on, each through its public barrel only. A dependency not listed here is refused by the schematics and by the lint boundaries. Relationship is `customer-supplier`, `conformist` or `acl`.

| Depends on | Relationship |
| ---------- | ------------ |

## Architecture level: strict

Use cases receive their driven ports (`make<UseCase>(ports)`) and are wired in the slice's `composition.ts` with `useFactory`/`inject`. `application/` and `domain/` import no infrastructure and no framework. Rules are pure functions, tested without a database.
