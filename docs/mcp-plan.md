# MCP connector: implementation plan

Branch `feat/mcp-connector`, target 13 Nov 2026. Design: https://claude.ai/artifact/FotjDiTVjAf6riVTNiTqPv

Every task ends the same way: its tests are written and pass, then `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration` and (for schema or API changes) `npm run openapi` / `npm run erd` are green, then one commit. A task is ticked only after that commit.

Tasks marked *(stretch)* are done only if time allows before the deadline.

## 0. Setup

- [ ] **T1. Dependencies.** Upgrade `better-auth` 1.7.10 → 1.7.14; add `@better-auth/oauth-provider` 1.7.14 and `@modelcontextprotocol/sdk` 1.32.2. Find which plugin tables are required.
  - Tests: the whole existing suite, lint, typecheck and build pass unchanged.

## 1. Domain (pure functions)

- [ ] **T2. Masking** `src/server/domain/mask.ts`: `maskName`, `maskPhone`, `maskAddress`, `maskEmail`.
  - Unit: Lebanese and foreign E.164 phones, short numbers, Arabic and Latin names, single-word names, empty values.
- [ ] **T3. Arabic search** `src/server/domain/arabic.ts`: `normalizeSearch` (alef forms, ة/ه, ى/ي, diacritics, tatweel, case).
  - Unit: "عِطر" matches "عطر", "أحمر" matches "احمر", Latin text unchanged apart from case.
- [ ] **T4. Scopes and tool policy** `src/server/domain/mcpPolicy.ts`: scopes (`orders:read`, `catalogue:read`, `catalogue:write`, `finance:read`), tool → `{ action, scope }`, `scopesForRole(role)`, `canUseTool(role, scopes, tool)`.
  - Unit: generated from `policy.ts`, so every role × tool matches `can()`; a scope missing from the token denies; scopes beyond the role are never offered.

## 2. OAuth server

- [ ] **T5. Schema and migration.** Plugin tables, `productImport`, `mcpToolCall`, `product.importId`; regenerate ERD.
  - Integration: migration applies on the test DB; `npm run erd` leaves no diff.
- [ ] **T6. Plugin and discovery.** Configure the plugin in `auth.ts` (opaque tokens, dynamic registration, PKCE, 1 h access / 30 d refresh), allow only the OAuth paths in the `before` hook, add `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.
  - Integration: metadata documents have the right issuer, endpoints and scopes; a client can register; the organization and admin endpoints still return 404 (extends `auth-endpoints.test.ts`).
- [ ] **T7. Shop picker and consent.** Pages `/connect/shop` and `/connect/consent` (English and Arabic); `postLogin.consentReferenceId` stores the shop; a service lists connectable shops and the scopes each role may grant.
  - Integration: full authorize → code → token flow with PKCE; the token's `referenceId` is the chosen shop; one-shop users skip the picker; suspended shops are not listed; Staff can't be granted `finance:read`; Delivery only gets `orders:read`; a shop the user isn't a member of is refused.

## 3. MCP core

- [ ] **T8. `resolveMcpActor`** in `src/server/http/`: bearer token → `Actor`.
  - Integration: valid token works; expired, revoked, wrong audience, removed member, suspended shop and banned user are refused; a role change applies on the next call.
- [ ] **T9. Endpoint and wrapper.** `src/app/api/mcp/route.ts` (Streamable HTTP, stateless); `defineTool` in `src/server/mcp/` runs actor → `canUseTool` → strict Zod → service → audit row in `mcpToolCall`; per-token rate limit; ESLint stops `src/server/mcp` importing repositories; first tool `shop_info` (shop name, currency, the user's role).
  - Integration: no token → 401 with `WWW-Authenticate` pointing to the resource metadata; `initialize` and `tools/list` work; each role lists only its tools; calling a hidden tool → denied; unknown fields such as `shopId` → invalid; audit rows for OK, DENIED and INVALID, with no inputs or outputs stored.

## 4. Read tools

- [ ] **T10. Order tools:** `list_orders`, `get_order`, `my_deliveries`, with masked customers.
  - Integration: role access; shop A token can't see shop B orders; delivery sees only assigned orders; filters and paging; masking applied.
- [ ] **T11. Catalogue tools:** `list_products` (Arabic search), `stock_levels`, `list_reviews`.
  - Integration: role access, isolation, Arabic search, low-stock threshold, archived products only on request.
- [ ] **T12. Finance tools:** `sales_metrics`, `cod_reconciliation`, `unsettled_cash`.
  - Integration: owner and manager only; numbers match the existing reporting and reconciliation services; USD and LBP formatting.
- [ ] **T13. Cross-cutting checks.**
  - Integration: one generated test calls every tool as every role and checks allow/deny against `canUseTool`; one test scans every read tool's output and finds no full phone number or email.

## 5. Product import

- [ ] **T14. Preview.** `productImportService.preview` + `productImportRepo`; tool `preview_product_import` (max 100 products, `CreateProductBody` rows).
  - Integration: writes no products; per-row errors; duplicate name and SKU flags; new categories listed; USD and LBP prices; a new preview replaces the user's previous one; Staff and Delivery denied.
- [ ] **T15. Confirm and undo.** Tools `confirm_product_import` and `undo_product_import`; products created active with `importId`; response includes dashboard links.
  - Integration: products appear in the dashboard product list and storefront; retry returns the same result; another user, another shop, a replaced preview or an expired preview is refused; one bad row rolls back everything; undo archives exactly that import's products and only within 24 h; Arabic names round-trip.
- [ ] **T16. Cleanup** *(stretch)*. Expired previews deleted by the existing `expire-reservations` cron run.
  - Integration: old previews removed, confirmed imports kept.

## 6. Dashboard

- [ ] **T17. Connected apps and revoke.** Service, routes (registered in `openapi.ts`) and settings page: owner sees and revokes every connection to the shop, members their own; removing a member, banning a user or changing a password revokes their tokens.
  - Integration: owner revokes any; staff revokes only their own and gets 404 for others; revoked token fails on the next MCP call; each automatic cut-off works; "last used" comes from `mcpToolCall`.
- [ ] **T18. Dashboard CSV upload** *(stretch)*. Upload a CSV in the products page, parse to rows, reuse preview and confirm.
  - Unit: CSV parsing (quotes, Arabic, one row per variant). Integration: upload → preview → confirm.

## 7. Ship

- [ ] **T19. Docs.** `docs/mcp.md` (connect steps for Claude and ChatGPT, tools, roles), FR/NFR additions, README section, CLAUDE.md status, regenerated OpenAPI and ERD.
- [ ] **T20. Real clients.** Run the app behind an HTTPS tunnel; test with MCP Inspector, then Claude (web and mobile voice) and ChatGPT (developer mode and voice) against the manual checklist, in English and Arabic, for each role.
- [ ] **T21. AI evals** *(stretch)*. `scripts/mcp-evals.ts`: about 40 prompts through the Claude API against a seeded shop, graded by DB state and `mcpToolCall`.
- [ ] **T22. Pull request.** Push the branch, open the PR into `main`, wait for CI to pass, merge.
