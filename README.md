# Mahhali

Shop Link: orders for Instagram and WhatsApp shops. A catalogue link for the bio, guest orders that
reserve stock instantly, an order board from New to Delivered, and cash-on-delivery reconciliation
per courier. Built for small brands in Lebanon that price in US dollars or Lebanese pounds.

- Requirements: [docs/FR-NFR.md](docs/FR-NFR.md)
- Database: [docs/erd.md](docs/erd.md) (generated from the Prisma schema)
- API contract: [docs/openapi.json](docs/openapi.json) (generated from the Zod schemas)
- Deployment: [deploy/README.md](deploy/README.md)

## Setup

Requirements: Node 22 and Docker (or any PostgreSQL 16).

```bash
cp .env.example .env          # then set BETTER_AUTH_SECRET
docker compose up -d db       # PostgreSQL with a mahhali and a mahhali_test database
npm install
npx prisma migrate dev        # create the tables
npm run dev                   # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm test` | Unit and integration tests (integration uses `TEST_DATABASE_URL` and empties it) |
| `npm run test:unit` | Business rules only, no database |
| `npm run test:integration` | Route handlers against real PostgreSQL |
| `npm run lint` / `npm run typecheck` | ESLint (including the layer rules below) and TypeScript |
| `npm run openapi` / `npm run erd` | Regenerate `docs/openapi.json` and `docs/erd.md`; CI fails if they are stale |

Try it:

```bash
curl -c cookies.txt -X POST localhost:3000/api/signup -H 'content-type: application/json' \
  -d '{"name":"Rami","email":"rami@example.com","password":"correct-horse-battery","shopName":"Rami Leather","shopSlug":"rami-leather","currency":"USD"}'
curl -b cookies.txt -X POST localhost:3000/api/products -H 'content-type: application/json' \
  -d '{"name":"Wallet","variants":[{"colour":"Brown","price":"35","stock":4}]}'
curl localhost:3000/api/public/shops/rami-leather/catalogue
```

## Architecture

```
src/
  app/api/**/route.ts      thin route handlers, one withRoute() call each
  server/
    http/withRoute.ts      session -> shop membership -> role check -> Zod validation -> handler -> errors
    validation/            Zod schemas; also the source of docs/openapi.json
    services/              business operations and transactions; call repositories, never Prisma
    domain/                pure rules with no I/O: role policy, order status machine, money, phone
    repositories/          the only code that touches Prisma; every function takes shopId
    auth/                  Better Auth (email and password, organization and admin plugins)
prisma/schema.prisma       all tables, including Better Auth's
tests/unit                 domain rules
tests/integration          route handlers against PostgreSQL, including tenant isolation
```

ESLint enforces the layers: only `src/server/repositories` may import Prisma, and route handlers may
not import repositories.

Every response error has the same shape: `{ "error": { "code", "message", "details" } }`.

### Roles

| Action | Owner | Manager | Staff | Delivery |
| --- | --- | --- | --- | --- |
| See and move orders, create manual orders, assign couriers | Yes | Yes | Yes | No |
| See only orders assigned to them, mark them delivered or failed | Yes | Yes | Yes | Yes |
| Products, prices, stock | Yes | Yes | View | No |
| Couriers | Yes | Yes | View | No |
| Remittances, reconciliation, metrics, hide reviews | Yes | Yes | No | No |
| Shop settings, staff, billing | Yes | No | No | No |

Platform admins (the Mahhali team) use Better Auth's admin role on the user. The whole table lives in
`src/server/domain/policy.ts` and is unit tested row by row.

## Key decisions

- **Tenant isolation in the repository layer.** One database, a `shopId` column on every shop table,
  and `shopId` is a required argument of every repository function rather than a filter to remember.
  The active shop comes from the session, never from the request. Another shop's records return 404,
  so ids reveal nothing. `tests/integration/tenant-isolation.test.ts` tries every role of shop A
  against shop B.
- **Better Auth with our own tables.** Its organization is our `Shop` and its member is our
  `Membership` (renamed in `auth.ts`), so sign-in, sessions and invitations come from the library
  while roles and permissions stay in our domain code.
- **Stock reservation without explicit locks.** Placing an order will move quantity from `available` to
  `reserved` with a conditional update (`WHERE available >= qty`) inside one transaction. PostgreSQL
  re-checks the condition after a concurrent update commits, so the last item sells once. CHECK
  constraints keep stock from going negative even if code is wrong.
- **Order numbers from a per-shop counter** incremented in the order transaction, with a unique
  `(shopId, number)` index. Customers track orders through a random token, or number plus phone,
  never the number alone.
- **Money as integers.** US dollars in cents, Lebanese pounds in whole pounds, all `bigint` because
  pound amounts pass 2^31. Each order freezes the shop's exchange rate; cash collected is recorded in
  the currency it was paid in and converted at that rate during reconciliation.
- **Variants as size and colour columns**, not a generic option system: simpler to query and validate,
  and it is what the shops sell.
- **Plain PostgreSQL on one server** with Docker Compose, deployed by CI over SSH. A long-running Node
  server avoids serverless connection-pool and transaction-timeout problems.

## Status

Foundation in place: schema for the whole V1, sign-up, products, public catalogue, role policy, order
status machine, money and phone rules, CI. Next: order placement with stock reservation and the
concurrency test, the order board, couriers and reconciliation.
