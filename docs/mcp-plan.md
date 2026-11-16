# MCP connector: implementation plan

Branch `feat/mcp-connector`, target 13 Nov 2026. Design: https://claude.ai/artifact/FotjDiTVjAf6riVTNiTqPv

Every task ends the same way: its tests are written and pass, then `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration` and (for schema or API changes) `npm run openapi` / `npm run erd` are green, then one commit. A task is ticked only after that commit.

Tasks marked *(stretch)* are done only if time allows before the deadline.

## 0. Setup

- [x] **T1. Dependencies.** Upgrade `better-auth` 1.7.10 → 1.7.14; add `@better-auth/oauth-provider` 1.7.14 and `@modelcontextprotocol/sdk` 1.32.2. Find which plugin tables are required.
  - Tests: the whole existing suite, lint, typecheck and build pass unchanged.
  - Done: `overrides` pin `@better-auth/core` 1.7.14 and `better-call` 1.4.4 so the plugin's `^1.7.14` peer doesn't pull in 1.7.20. The plugin registers all 7 tables unconditionally, and `oauthResource` is used: the `/api/mcp` audience is seeded there from the `resources` option and tokens are checked against it. T5 creates all 7.

## 1. Domain (pure functions)

- [x] **T2. Masking** `src/server/domain/mask.ts`: `maskName`, `maskPhone`, `maskAddress`, `maskText` (hides phones and emails in customer notes).
  - Unit: Lebanese and foreign E.164 phones, short numbers, Arabic and Latin names, single-word names, empty values.
- [x] **T3. Arabic search** `src/server/domain/arabic.ts`: `normalizeSearch` (alef forms, ة/ه, ى/ي, diacritics, tatweel, case).
  - Unit: "عِطر" matches "عطر", "أحمر" matches "احمر", Latin text unchanged apart from case.
- [x] **T4. Scopes and tool policy** `src/server/domain/mcpPolicy.ts`: scopes (`orders:read`, `catalogue:read`, `catalogue:write`, `finance:read`), tool → `{ action, scope }`, `scopesForRole(role)`, `canUseTool(role, scopes, tool)`.
  - Unit: generated from `policy.ts`, so every role × tool matches `can()`; a scope missing from the token denies; scopes beyond the role are never offered.

## 2. OAuth server

- [x] **T5. Schema and migration.** Plugin tables (`oauthClient`, `oauthResource`, `oauthClientResource`, `oauthRefreshToken`, `oauthAccessToken`, `oauthConsent`, `oauthClientAssertion`), `productImport`, `mcpToolCall`, `product.importId`; regenerate ERD.
  - Integration: migration applies on the test DB; `npm run erd` leaves no diff.
- [x] **T6. Plugin and discovery.** Configure the plugin in `auth.ts` (opaque tokens, dynamic registration, PKCE, 1 h access / 30 d refresh), allow only the OAuth paths in the `before` hook, add `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.
  - Integration: metadata documents have the right issuer, endpoints and scopes; a client can register; the organization and admin endpoints still return 404 (extends `auth-endpoints.test.ts`).
- [x] **T7. Shop picker and consent.** Pages `/connect/shop` and `/connect/consent` (English and Arabic); `postLogin.consentReferenceId` stores the shop; a service lists connectable shops and the scopes each role may grant.
  - Integration: full authorize → code → token flow with PKCE; the token's `referenceId` is the chosen shop; one-shop users skip the picker; suspended shops are not listed; Staff can't be granted `finance:read`; Delivery only gets `orders:read`; a shop the user isn't a member of is refused.

## 3. MCP core

- [x] **T8. `resolveMcpActor`** in `src/server/http/`: bearer token → `Actor`.
  - Integration: valid token works; expired, revoked, wrong audience, removed member, suspended shop and banned user are refused; a role change applies on the next call.
- [x] **T9. Endpoint and wrapper.** `src/app/api/mcp/route.ts` (Streamable HTTP, stateless); `defineTool` in `src/server/mcp/` runs actor → `canUseTool` → strict Zod → service → audit row in `mcpToolCall`; per-token rate limit; ESLint stops `src/server/mcp` importing repositories; first tool `shop_info` (shop name, currency, the user's role).
  - Integration: no token → 401 with `WWW-Authenticate` pointing to the resource metadata; `initialize` and `tools/list` work; each role lists only its tools; calling a hidden tool → denied; unknown fields such as `shopId` → invalid; audit rows for OK, DENIED and INVALID, with no inputs or outputs stored.

## 4. Read tools

- [x] **T10. Order tools:** `list_orders`, `get_order`, `my_deliveries`, with masked customers.
  - Integration: role access; shop A token can't see shop B orders; delivery sees only assigned orders; filters and paging; masking applied.
- [x] **T11. Catalogue tools:** `list_products` (Arabic search), `stock_levels`, `list_reviews`.
  - Integration: role access, isolation, Arabic search, low-stock threshold, archived products only on request.
- [x] **T12. Finance tools:** `sales_metrics`, `cod_reconciliation`, `unsettled_cash`.
  - Integration: owner and manager only; numbers match the existing reporting and reconciliation services; USD and LBP formatting.
- [x] **T13. Cross-cutting checks.**
  - Integration: one generated test calls every tool as every role and checks allow/deny against `canUseTool`; one test scans every read tool's output and finds no full phone number or email.

## 5. Product import

- [x] **T14. Preview.** `productImportService.preview` + `productImportRepo`; tool `preview_product_import` (max 100 products, `CreateProductBody` rows).
  - Integration: writes no products; per-row errors; duplicate name and SKU flags; new categories listed; USD and LBP prices; a new preview replaces the user's previous one; Staff and Delivery denied.
- [x] **T15. Confirm and undo.** Tools `confirm_product_import` and `undo_product_import`; products created active with `importId`; response includes dashboard links.
  - Integration: products appear in the dashboard product list and storefront; retry returns the same result; another user, another shop, a replaced preview or an expired preview is refused; one bad row rolls back everything; undo archives exactly that import's products and only within 24 h; Arabic names round-trip.
- [x] **T16. Cleanup** *(stretch)*. Expired previews deleted by the existing `expire-reservations` cron run.
  - Integration: old previews removed, confirmed imports kept.

## 6. Dashboard

- [x] **T17. Connected apps and revoke.** Service, routes (registered in `openapi.ts`) and settings page: owner sees and revokes every connection to the shop, members their own; removing a member, banning a user or changing a password revokes their tokens.
  - Integration: owner revokes any; staff revokes only their own and gets 404 for others; revoked token fails on the next MCP call; each automatic cut-off works; "last used" comes from `mcpToolCall`.
- [ ] **T18. Dashboard CSV upload** *(stretch)*. Upload a CSV in the products page, parse to rows, reuse preview and confirm.
  - Unit: CSV parsing (quotes, Arabic, one row per variant). Integration: upload → preview → confirm.

## 7. Ship

- [x] **T19. Docs.** `docs/mcp.md` (connect steps for Claude and ChatGPT, tools, roles), FR/NFR additions, README section, CLAUDE.md status, regenerated OpenAPI and ERD.
- [ ] **T20. Real clients.** Run the app behind an HTTPS tunnel; test with MCP Inspector, then Claude (web and mobile voice) and ChatGPT (developer mode and voice) against the manual checklist, in English and Arabic, for each role.
- [ ] **T21. AI evals** *(stretch)*. `scripts/mcp-evals.ts`: about 40 prompts through the Claude API against a seeded shop, graded by DB state and `mcpToolCall`.
- [ ] **T22. Pull request.** Push the branch, open the PR into `main`, wait for CI to pass, merge.

## 8. Product photos (follow-up, same branch)

Assistants can't hand image files to MCP tools, so photos come in two ways:

- **Route 1, photo links.** A CSV `images` column (links separated by `|`), or links typed in the chat. The assistant passes them per product, optionally tied to a colour (`optionValue`). Photos are downloaded at preview time; a bad link is a warning on that row, not an error, so the product can still be imported. Confirm attaches them. Google Drive and Dropbox share links are turned into direct downloads; Instagram post links are refused with a clear message.
- **Route 2, "Add photos" page.** After confirm the reply carries a link `/p/<token>`, valid 24 h, no login. The page (mobile, English and Arabic) lists the products from that import with their photos; the user picks several photos or takes them with the camera, optionally picks a colour, and they appear in the dashboard within 2 s. The tool `photo_upload_link({ importId })` makes a fresh link (the old one stops working).

Rules (agreed 2026-11-12):
- At most **5 photos per product**, from either route together. Photos can be added, not deleted, through these routes (deleting stays in the dashboard).
- Links must be **HTTPS** on the default port, with no username or password in them. The server looks up the host, refuses private, loopback, link-local and internal addresses (IPv4 and IPv6, including tricks like `127.1`, `0x7f.1` and `::ffff:10.0.0.1`), connects to the address it checked, and re-checks each redirect (max 3). 10 s timeout, 3 MB cap while streaming, and the bytes must really be PNG, JPEG or WebP.
- At most 50 downloads per preview call. Photos of unconfirmed previews are deleted by the cleanup cron.
- An upload link works only for its own import's products, dies on expiry, undo or a suspended shop, and is rate-limited per link and per IP. A wrong, expired or foreign token → 404.

- [ ] **T23. Link rules** `src/server/domain/photoLinks.ts` (pure): parse and normalise links, Drive/Dropbox rewrite, refuse http, ports, userinfo, Instagram; `isPublicAddress(ip)`; per-product cap.
  - Unit: HTTPS only; Drive `file/d/<id>/view` and `open?id=` → direct; Dropbox `dl=0` → `raw=1`; private IPv4 ranges, `127.1`, `0x7f.1`, decimal `2130706433`, IPv6 `::1`, `fe80::`, `fc00::`, `::ffff:10.0.0.1` refused; public addresses allowed; colour must be one of the product's option values; a 6th photo refused.
- [ ] **T24. Safe downloader** `src/server/storage/fetchPhoto.ts`: DNS check, pinned connection, redirects re-checked, timeout, size cap, type sniffing, saved through `saveUpload`.
  - Integration (local HTTPS test server + fake DNS): good photo saved; HTML page refused; 4 MB refused mid-stream; slow server times out; redirect to a private address refused; redirect loop refused; host that resolves to `127.0.0.1` refused.
- [ ] **T25. Photos in preview and confirm.** `images: [{ url, colour? }]` on each product in `preview_product_import`; warnings per row; confirm attaches them in order; cleanup deletes files of unconfirmed previews; instructions updated.
  - Integration: preview with 2 good links and 1 bad → 2 photos, 1 warning, product ready; confirm → photos on the product in the dashboard API and storefront; colour stored as `optionValue`; 6 links → only 5 kept with a warning; re-preview deletes the old preview's files; expired preview files removed by cron; Arabic product names with photos.
- [ ] **T26. Upload links.** Table `import_photo_link` (token hash, import, shop, creator, expiry) + migration; link returned by `confirm_product_import`; tool `photo_upload_link`; added to the policy matrix.
  - Integration: confirm returns a working link; a new link replaces the old; Staff and Delivery can't call the tool; another user's or shop's import → not found; undone import → refused.
- [ ] **T27. Upload page API** `GET/POST /api/photo-links/[token]` (registered in OpenAPI).
  - Integration: lists only that import's products and photos; uploads several photos in one request; colour stored; a 6th photo refused; fake image refused; wrong, expired, undone-import and suspended-shop tokens → 404; a product from another import or shop → 404; rate limit hits 429.
- [ ] **T28. Upload page UI** `src/app/p/[token]` (English and Arabic, mobile): multi-select and camera, colour picker, in-browser downscaling to fit 3 MB, progress, thumbnails.
  - Unit: downscale size calculation. Integration: the page renders for a valid token and 404s for a bad one.
- [ ] **T29. Docs.** `docs/mcp.md` (how users add photos), FR-40/41, OpenAPI, ERD, CLAUDE.md.
- [ ] **T30. Manual test, then PR.** You test both routes in Claude (CSV with links, typed links, upload page on a phone); after your OK, push and open a PR into `sandbox`.
