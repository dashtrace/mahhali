# Shop Link (Mahhali)

Order management for Instagram/WhatsApp shops in Lebanon: catalogue with variants, guest orders that reserve stock instantly, order board (New → Delivered), COD reconciliation per courier. Hackathon-style challenge; review after 8 Nov 2026.

## Docs
- Build plan: https://claude.ai/artifact/WvwEuPsxbrVE6DCPTNivKZ
- Requirements (FR/NFR): https://claude.ai/artifact/7KahEVuL4PkPxgUEC35nyF (repo copy: docs/FR-NFR.md)
- Visual ERD: https://claude.ai/artifact/3CAsX2DKMAyFFzbkMPAEY4 (repo copy: docs/erd.md, generated)
- OpenAPI: docs/openapi.json (generated)

## Definition of Done (graded)
Live URL deployed by CI; CI runs tests on every PR; Next.js route handlers (TS) + Prisma; repository layer separate from service layer; validation on every route; multi-tenant with isolation test; 2+ roles; mobile-first; README, FR/NFR, ERD, OpenAPI; unit + integration tests. Extras: Stripe test-mode pricing page, Arabic UI, stretch goal (TBD).

## Key decisions
- Customers are guests and never sign in. Track orders by private token link or order number + phone (number alone never opens an order). Order numbers are per shop, starting at #1001 (Shop.nextOrderSeq).
- Auth: Better Auth 1.7 with organization plugin (organization → `shop`, member → `membership`, organizationId → `shopId`, activeOrganizationId → `activeShopId` column; in TS the session field is still `activeOrganizationId`) and admin plugin for platform admins.
- Roles: platform Admin (team, read-only + audited), shop Owner, Manager, Staff, Delivery (company or individual; sees only assigned orders, marks delivered/failed). Owner/Manager/Staff assign couriers and filter by courier. Each order records who delivered it.
- Verified reviews: after Delivered, a single-use emailed link (ReviewInvite token hash, 30-day expiry); link also on tracking page; customer email optional.
- Shops upload a logo and customise theme.
- Money: BigInt minor units (USD cents, LBP whole pounds). Shop.currency USD|LBP; usdLbpRate Decimal(14,2) frozen per order; cash collected recorded as USD cents and LBP separately.
- Phones normalised to E.164 (default LB). Lebanese address fields.
- Database: plain self-hosted PostgreSQL 16. NOT Supabase or Neon.
- Deploy: one VPS, Docker Compose (app + postgres + caddy), CI deploys over SSH (gated by repo variable DEPLOY_ENABLED), nightly pg_dump. See deploy/README.md.
- NFR wording: state requirements only (atomic/ACID); no "proven by automated test" lines in the requirements doc.

## Architecture rules (enforced by ESLint no-restricted-imports)
route (`src/app/api/**/route.ts`, wrapped in `withRoute`) → services (`src/server/services`) → domain (`src/server/domain`, pure) → repositories (`src/server/repositories`, the only Prisma users, every query takes shopId).
- `withRoute` resolves the actor, checks `can(role, action)` from domain/policy.ts, and validates params/query/body with Zod (src/server/validation).
- Errors: `{ error: { code, message, details } }` via AppError helpers. Another shop's record → 404, role without the action → 403.
- New routes must be registered in src/server/validation/openapi.ts; run `npm run openapi` and `npm run erd` after API or schema changes (CI fails if docs are out of sync).

## Local setup (Windows, native PostgreSQL)
.env needs DATABASE_URL (db `mahhali`), TEST_DATABASE_URL (db `mahhali_test`, gets TRUNCATEd by tests; never point it at a real DB), BETTER_AUTH_SECRET, BETTER_AUTH_URL=http://localhost:3000. See .env.example.
```
psql -U postgres -c "CREATE DATABASE mahhali;"
psql -U postgres -c "CREATE DATABASE mahhali_test;"
npm install
npx prisma migrate dev
npm run dev
```
Alternative: `docker compose up -d db` (needs Docker Desktop running).

## Commands
`npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm test`, `npm run build`, `npm run openapi`, `npm run erd`, `npm run db:migrate`, `npm run db:seed`.

## Status
Done on branch `feat/foundation` (commit 465e71d, 125 tests passing): schema + migration with CHECK constraints, Better Auth, policy matrix, signup (business + owner), products CRUD with variants, public catalogue, health, tenant-isolation test, CI workflow, Dockerfile and deploy scripts, docs. Branch not pushed yet; open a PR into main.

## Next
1. Order placement (public): stock reservation via conditional `updateMany` (available >= qty) in one transaction, per-shop order number, idempotency key, publicToken; concurrency test (many buyers for the last item).
2. Order board: status transitions (domain/orderStatus.ts), stock effects on ship/cancel/return, courier assignment and filtering.
3. Delivery role views, mark delivered/failed, COD collection and remittance reconciliation.
4. Tracking page, review invites (email via Resend), logo/theme, admin views.
5. Mobile-first UI, Arabic UI, Stripe test-mode pricing page, deploy to VPS.

Open questions: confirm 8 Nov deadline, the brief's stretch goal, pilot couriers, VPS provider and domain, team work split.
