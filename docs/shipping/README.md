# Shipping

## Classification

| Axis               | Value      | What it decides                                                   |
| ------------------ | ---------- | ----------------------------------------------------------------- |
| Subdomain class    | supporting | design investment                                                 |
| Criticality        | medium     | verification rigor                                                |
| Volatility         | medium     | how much cleanup is worth                                         |
| Architecture level | standard   | derived: strict when the class is core or the criticality is high |

## Subdomains

One slice of code per row; docs mirror the code, so a context with several subdomains keeps one folder per subdomain.

| Subdomain                   | Responsibility                                      |
| --------------------------- | --------------------------------------------------- |
| [shipping](domain-model.md) | Plans and tracks fulfilment and delivery of orders. |

## Context map

The contexts this one depends on, each through its public barrel only. A dependency not listed here is refused by the schematics and by the lint boundaries. Relationship is `customer-supplier`, `conformist` or `acl`.

| Depends on | Relationship |
| ---------- | ------------ |
| ordering   | conformist   |

## Architecture level: standard

Use cases may import their adapters directly; driven ports are optional. Promote a slice to strict when it starts to handle money, access or an external system.
