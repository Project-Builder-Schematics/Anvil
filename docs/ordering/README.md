# Ordering

## Classification

| Axis               | Value          | What it decides                                                   |
| ------------------ | -------------- | ----------------------------------------------------------------- |
| Subdomain class    | core (assumed) | design investment                                                 |
| Criticality        | high (assumed) | verification rigor                                                |
| Volatility         | high (assumed) | how much cleanup is worth                                         |
| Architecture level | strict         | derived: strict when the class is core or the criticality is high |

The classification is an assumption until the person confirms it; the strict level applies meanwhile.

Context map: not mapped yet.

## Architecture level: strict

Use cases receive their driven ports (`make<UseCase>(ports)`) and are wired in the slice's `composition.ts` with `useFactory`/`inject`. `application/` and `domain/` import no infrastructure and no framework. Rules are pure functions, tested without a database.
