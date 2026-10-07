# Notifications

## Classification

| Axis               | Value    | What it decides                                                   |
| ------------------ | -------- | ----------------------------------------------------------------- |
| Subdomain class    | generic  | design investment                                                 |
| Criticality        | low      | verification rigor                                                |
| Volatility         | low      | how much cleanup is worth                                         |
| Architecture level | standard | derived: strict when the class is core or the criticality is high |

## Context map

The contexts this one depends on, each through its public barrel only. A dependency not listed here is refused by the schematics and by the lint boundaries. Relationship is `customer-supplier`, `conformist` or `acl`.

| Depends on | Relationship |
| ---------- | ------------ |
| ordering   | conformist   |
| shipping   | conformist   |

## Architecture level: standard

Use cases may import their adapters directly; driven ports are optional. Promote a slice to strict when it starts to handle money, access or an external system.
