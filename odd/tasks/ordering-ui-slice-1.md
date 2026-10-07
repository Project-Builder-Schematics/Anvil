# Ordering UI: slice 1

## Objective

Build the web UI for the ordering slice 1 API: create an order, add lines, place it and cancel it. The UI is built in `libs/web/ordering` with the project's Angular schematics and the design system.

## Problem / why

The user chose vertical slices on 2026-10-08, so every slice ships its UI. Slice 1 has an API and no UI. This slice will:

- validate the API from a real client: CORS, CSRF and status codes;
- give the Angular schematics their first real use;
- run the `checkout-cta` A/B experiment on a real flow.

## Scope

- **Order page** at route `/orders/:orderId`, plus a "New order" entry at `/orders/new`, which calls `POST /orders` and navigates to the new order.
  - Order view: status, lines (product, quantity, unit price, line total) and the order total.
  - Add-line form (productId, quantity), using Signal Forms. Client validation mirrors rule 2 (1–99), but the server stays authoritative.
  - **Place** and **Cancel** actions, enabled by status (rules 4, 8 and 10). The Place button renders the `checkout-cta` variants through `*dsVariant`.
  - Error display: each refusal code maps to a human message, and unknown codes get a generic one.
- **Data access.** An `ordering` API client using `httpResource` for reads and `HttpClient` for commands. It is typed from a web-side DTO in `libs/web/ordering/domain`, never imported from the api libs (the module boundaries forbid web → api).
- **Layers.**
  - `feature`: containers, routes.
  - `ui`: presentational components that use only `--ds-*` tokens.
  - `data-access`: the API client and an order store with signals.
  - `domain`: DTO types and the error-code → message map.
- **Product input.** Free text: no catalog API exists yet, so an unknown product shows the `PRODUCT_NOT_FOUND` message. A product picker comes with the catalog slice.

Out of scope: auth, a list of orders (no list endpoint exists), and the catalog picker.

## Constraints

- Every component, service and directive comes from the schematics (`ng-component`, `ng-service`, `ng-directive`). Misses and defects go to `schematics/IMPACT.md`, and a fitting fix goes into the schematic with tests.
- Use the Angular 22 rules from `workspace-scaffold.md` T8:
  - zoneless, default OnPush, signals, `inject()`;
  - control flow, Signal Forms, `httpResource`;
  - no type suffixes in file names, protected template members.
- Accessibility: labelled form fields, error messages tied to their fields with `aria-describedby`, keyboard-operable actions, and visible focus.
- Strict TDD.
  - Component, store and client specs with the Angular unit-test builder (vitest + jsdom). Use `await fixture.whenStable()`.
  - HTTP is tested with `provideHttpClientTesting`.
  - Coverage gates follow the repo config.
- No builds or boots. The user verifies in the browser.

## Tasks

- [ ] U1: `domain`: DTOs and the error-message map. Route: delegated writer.
- [ ] U2: `data-access`: API client and store. Route: delegated writer.
- [ ] U3: `ui`: presentational components (order summary, line list, add-line form, action bar). Route: delegated writer.
- [ ] U4: `feature`: containers, routes, and wiring into `apps/web`. Route: delegated writer.

## Acceptance criteria

- Specs green for all four libs.
- `lint`, `typecheck` and `format` all green.
- The components come from schematics, and the IMPACT rows are recorded.
- A runtime checklist for the user: create → add → place → cancel in the browser, the CORS and CSRF headers, and the A/B variant forced with `?exp=checkout-cta:b`.

## Progress

- 2026-10-08: document created after the user chose vertical slices. It runs after `schematics-impact-round-1.md` and before `order-fulfilment-slice-2.md`.

## Next step

U1, after the schematics round lands.
