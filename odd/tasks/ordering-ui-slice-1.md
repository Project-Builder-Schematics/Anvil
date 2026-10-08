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

Route per task: delegated writer (single writer, no parallel writers). Trigger evidence: each task writes 2 or more non-trivial files. Mode: strict TDD, runner `bun test schematics` for schematics and the Angular unit-test builder (`bunx nx test <project>`, vitest + jsdom) for the web libs.

- [x] S6 (prerequisite, `schematics-impact-round-1.md`): `ng-service` emits `@Service()`. Commit fa851e4. RED: 2 factory tests failed first.
- [x] U0 (schematic extension): `ng-component` accepts PascalCase types for inputs and outputs, plus `type_import`. Commit a7758ff. RED: 4 factory tests failed first. The AXE helper and the focus ring came with 44221d5, and `axe-core` with 150c352.
- [x] U1: `domain`: DTOs, totals, status predicates, `isQuantity`, and the error-message map. Commit b8d7cb0 (and `isQuantity` in 1a5f43c). RED: 3 suites failed on a missing module, then 12 `isQuantity` cases failed.
- [x] U2: `data-access`: `OrderingApi` (HttpClient commands, `httpResource` read), `errorCodeOf`, `OrderStore`. Commits c329901 and 13e7eda. RED: compile errors for the missing members, then 2 store tests, then the boolean results.
- [x] U3: `ui`: `order-summary`, `line-list`, `add-line-form` (Signal Forms), `order-actions` (`*dsVariant` place label). Commit 1a5f43c. RED: 4 spec files failed (26 of 32 tests) before the templates existed.
- [x] U4: `feature`: `order-page`, `order-new`, `orderingRoutes`, wiring into `apps/web` (lazy `orders` route, redirect from `/`, `provideHttpClient`, the page shell). Commit e0c315f. RED: 13 feature tests failed before the containers existed, the routes spec failed on a missing module, and 3 app specs failed before the wiring.

## Acceptance criteria

- Specs green for all four libs.
- `lint`, `typecheck` and `format` all green.
- The components come from schematics, and the IMPACT rows are recorded.
- A runtime checklist for the user: create → add → place → cancel in the browser, the CORS and CSRF headers, and the A/B variant forced with `?exp=checkout-cta:b`.

## Assumptions

Product decisions the doc did not settle; each is the simplest option.

- Copy of the `checkout-cta` variants on the Place button: `control` shows "Place order", `b` shows "Place order securely". The placeholder demo in `apps/web` used "Pay now" and "Pay securely", but placing an order is not a payment.
- `/` redirects to `/orders/new`, since there is no other entry point and no order list.
- The add-line form keeps its values after a line is added, so the user can add the same product again. The server stays authoritative on the quantity; the client check is 1 to 99 and an integer.
- Add-line, Place and Cancel run one command at a time (the store drops a command issued while another is in flight). The form is not disabled while busy, so keyboard focus is never lost from a field.
- Cancel has no confirmation step.
- After a successful Place or Cancel the clicked button becomes disabled, so keyboard focus falls back to the page. Moving focus to the status region is not done.
- Money is shown in `en-US`, using the currency's own minor-unit digits.
- The status and alert regions are always in the DOM (`role="status"` for loading and success messages, `role="alert"` for command and read errors), so changes are announced.
- Error messages and secondary text use `--ds-color-ink` and `--ds-color-body`, and `--ds-color-danger` only for borders. In the `stripe` theme `danger` on `canvas` is 4.29:1 and `muted` on `surface` is 4.49:1, below the 4.5:1 of AA for text; the `shopify` theme passes every pair used. The tokens were not changed.
- Routes are mounted under `orders` by the app and `orderingRoutes` reads `new` before `:orderId`.
- The API base is the relative `/api`. The production `nginx.conf` of `apps/web` has no `/api` proxy, so only the dev server's proxy serves the API from the browser.

## Verification evidence

- AXE: `axe-core` 4.14.0 runs under the Angular unit-test builder with jsdom through `axeViolations` (`@demo/web-shared-design-system/testing`, spec in the design-system lib). Every ui and feature spec asserts no violations. Colour contrast is disabled there because jsdom has no layout; it is the browser check below, and the token pairs were computed by hand (see the assumptions).
- CSRF and CORS: the API's cross-origin protection allows a state-changing request when `Sec-Fetch-Site` is `same-origin`, or when `Origin` matches the request host or the trusted origin. Through the dev proxy the browser calls its own origin, so the request is same-origin. `CORS_ORIGIN` is `http://localhost:4200` in `.env.example` and `docker-compose.yml`, and `tools/dev` sets it to `http://localhost:<webPort>` per worktree, which is the web dev origin. API security settings were not changed.

## Progress

- 2026-10-08: document created after the user chose vertical slices. It runs after `schematics-impact-round-1.md` and before `order-fulfilment-slice-2.md`.
- 2026-10-08: S6, U0 and U1 to U4 done in 12 commits on `feat/workspace-scaffold`; every commit left `bun test schematics` (252 pass), `nx run-many -t lint test typecheck` (18 projects) and `prettier --check .` green. The Engram mirror `odd/ordering-ui-slice-1/tasks` was not updated by the writer.

## Runtime checklist (for the user, in the browser)

1. `bun run dev --detach`, then read the web URL from `bun run dev:status`. Open it at `localhost`, not another host name.
2. Flow: `/` redirects to `/orders/new`, which creates an order and lands on `/orders/<id>`. Add a line (`keyboard`, `mouse`; the API seeds three demo products), see the line total and the order total, Place it, then Cancel it. Add and Place are disabled after Place; Cancel is disabled after Cancel.
3. Errors: add `ghost` (PRODUCT_NOT_FOUND), quantity `0`, `100` and `1.5` (client message, no request), Place an empty order (the button is disabled), open `/orders/nope` (not found message and a link to a new order), stop the API and try a command (network message). Each one shows its human message in the alert region and the next success clears it.
4. Network tab: every call is `/api/orders...` on the web origin, no `OPTIONS` preflight, `POST` requests carry `Origin` and `Sec-Fetch-Site: same-origin`, and none answers 403. A 403 means the origin did not match `CORS_ORIGIN`.
5. A/B variant: `?exp=checkout-cta:b` shows "Place order securely", `?exp=checkout-cta:control` shows "Place order"; the override persists for the session. The exposure is logged to the console (`exposure`).
6. Theme: `?exp=theme:b` switches `data-theme` to `stripe`; check the focus ring, the error borders and the status badge in both themes.
7. AXE in the browser (the axe DevTools extension or Lighthouse) on `/orders/new`, an empty draft, a draft with lines, a placed order and the not-found page, in both themes. This is where colour contrast is checked; expect the `stripe` theme to flag `muted` text on `surface` if any is used, and `danger` as text (none is).
8. Keyboard: Tab through the form and the actions, submit with Enter, check the visible focus ring, and check that a refused submit moves focus to the first invalid field.

## Follow-ups

The whole range was over the review budget (`lens_context_budget_exceeded`), so the user chose to review five slices. All five were approved and acknowledged on 2026-10-08:

- review-b15a3887f71399c7
- review-8010c9e4781b59a1
- review-7c3e5725720bdae1
- review-9488df4a71ba1475
- review-3e94cf65e53f6856

The advisory findings:

- [ ] U5: correctness fixes in the order flow. These land at the start of slice 2 F5, which touches the same libs.
  - The back button recreates an order: `/orders/new` creates on every visit. Navigate with `replaceUrl` (order-new.ts:21-28).
  - Navigation still runs after the component is destroyed (order-new.ts:25-28).
  - Store races:
    - An add-line response can land on another order (order-store.ts:44-45).
    - A status change can be stale (59-63).
    - Busy commands overlap (67-77).
    - Create clears the open order before the guard (40).
    - A dropped command is silent (73).
    - A command can run with no open order (43-53).
  - A notice stays visible after the route param changes (order-page.ts:61-67), and the param change is untested.
  - `` tracks lines by a key that can repeat (line-list.html:14).
  - `Order.lines` is mutable (domain order.ts:14).
- [x] Schematics, done together with S8 (6470ca2):
  - `ng-component` validates `type_import` as a package or relative path.
  - A type named like the component class or `Component` is refused, and an input or output with a second colon is refused instead of cut.
  - The test for a `type_import` with outputs only exists.
- [ ] `axe-core` is flagged as unused in the root package.json. That is a false positive: the design-system testing helper uses it. Verify.
- [ ] The `stripe` theme fails AA text contrast (danger on canvas 4.29:1, muted on surface 4.49:1). This needs a token decision.

## Next step

`order-fulfilment-slice-2.md`, which starts F5 with U5. S5, S7 and S8 (schematics) are done.
