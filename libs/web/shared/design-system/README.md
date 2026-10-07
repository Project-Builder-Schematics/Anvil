# Design system

Themes vendored from [awesome-design-md](https://github.com/voltagent/awesome-design-md) (MIT), a semantic token contract, a button, and an A/B experiments service. Components consume only `--ds-*` custom properties, never a brand value, so a theme swap needs no component change. `tools/design-system/tokens-usage.test.ts` fails when a component stylesheet uses a `--ds-*` name that is not in `src/tokens/contract.ts`.

## Add a theme

1. Copy the brand's `DESIGN.md` unmodified to `themes/<brand>/DESIGN.md` (`gh api repos/voltagent/awesome-design-md/contents/design-md/<brand>/DESIGN.md --jq .content | base64 -d`) and note the source in `themes/README.md`.
2. Write `themes/<brand>/mapping.yaml`: for every token in the contract, either `{ path: <frontmatter path> }` or `{ literal: <value> }` when the brand lacks it. Typography roles map to a whole typography entry.
3. Run `bun run design:themes` and commit `src/styles/themes.generated.css`.
4. `bun test tools/design-system` guards it: it fails if a contract token is unmapped or a path does not resolve.

To make the theme reachable from an experiment, give a variant a `theme` in `src/lib/experiments/registry.ts`.

## Add an experiment

Add an entry to `experiments` in `src/lib/experiments/registry.ts`: a `key`, a `status`, and variants with `weight` (the first variant is the control, served whenever the status is not `active`). Assignment is `hash(key + subjectId)` into the weight buckets, so a subject always sees the same variant.

- In a template: `<ng-container *dsVariant="'checkout-cta'; is: 'b'">...</ng-container>`.
- In code: `inject(ExperimentService).variant('checkout-cta')()`.
- Exposures go to the `ExposureSink` token (default `console.debug`), once per experiment per session. Provide your own sink to forward them elsewhere.

`provideExperiments()` (already in the web app config) sets `data-theme` on `<html>` for experiments whose variants carry a theme.

## Force a variant

Append `?exp=key:variant[,key:variant]`, for example `?exp=theme:b,checkout-cta:b`. The override is kept in `sessionStorage` for the rest of the session. The subject id is an anonymous UUID in `localStorage` until authentication exists.

## Why experiments live here

The `*dsVariant` directive must be usable from `type:ui` libs, which the module boundaries forbid from depending on `data-access` or `feature` libs. A separate experiments lib would have to be tagged `type:ui` anyway, so it stays here.

## Tests

Empty skeleton libs have no `test` target, because the Angular unit-test builder fails when it finds no spec. Add one, like the target in this lib's `project.json`, with the first spec.
