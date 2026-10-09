# 6. Design system from vendored themes with A/B experiments

## Context

Themes come from awesome-design-md, whose token names differ per brand. Theme and component level experiments are wanted.

## Decision

A fixed semantic token contract; per-brand `mapping.yaml` files; a Bun generator writes `--ds-*` CSS per `data-theme`. Components use only `--ds-*`. Experiments are a typed registry with deterministic hashing, `?exp=` overrides, and exposures through an injectable sink, living in the design-system lib so `type:ui` libs can use `*dsVariant`.

## Consequences

- Adding a brand is a DESIGN.md plus a mapping, guarded by a contract test.
- The generated CSS is committed.
