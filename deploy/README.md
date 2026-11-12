# Deploying Mahhali

The app runs on [Railway](https://railway.com): one service built from the `Dockerfile` and a
Railway PostgreSQL 16 database. CI runs the tests and then `railway up`, which builds the image,
runs `prisma migrate deploy` (the pre-deploy command in `railway.json`), checks `/api/health` and
switches traffic to the new version.

## One-time Railway setup

1. Create a project and add a **PostgreSQL** database.
2. Add an **empty service** named `mahhali`. Do not connect the GitHub repo to it: CI deploys it,
   so it only ships code that passed the tests.
3. On the service, add a **volume** mounted at `/app/uploads` (logos and product photos).
4. Under **Settings → Networking**, generate a domain (or add your own).
5. Set the service variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `BETTER_AUTH_SECRET` | long random string (32+ characters) |
   | `BETTER_AUTH_URL` | `https://<your domain>` |
   | `CRON_SECRET` | long random string |
   | `RAILWAY_RUN_UID` | `0` (the image runs as `node`; this lets it write to the volume) |
   | `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional, see below |
   | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET` | optional, see below |

6. Turn on backups for the Postgres volume (database service → **Backups**).
7. Create a **project token**: open the project, click **Settings** (top right of the project
   canvas, not your account settings), then **Tokens**, pick the `production` environment and
   create it. Account tokens from your profile page do not work here.

## Turn on deploys from CI

In the GitHub repository settings:

- Environment `production` → environment secret `RAILWAY_TOKEN` (the project token).
- Repository secret `CRON_SECRET` (same value as on Railway).
- Repository variables `APP_URL` = `https://<your domain>` and `DEPLOY_ENABLED` = `true`. They must
  be repository-level: the deploy condition is checked before the job loads its environment, and
  the scheduled jobs workflow does not use the environment.

Every merge to `main` then runs the tests and deploys. The **Scheduled jobs** workflow calls
`/api/cron/expire-reservations` and `/api/cron/review-emails` every 10 minutes; run it by hand from
the Actions tab to test it. GitHub does not keep to that schedule (runs have been 4 to 8 hours apart),
so these jobs can run late.

## Sandbox

A second Railway environment for demos and testing, with its own app, database, uploads volume and
domain. Pushes to the `sandbox` branch deploy there after the tests pass; `main` still deploys to
production. To try a change: `git checkout sandbox`, `git merge <branch>`, `git push`.

1. In Railway: environment drop-down → **+ New Environment** → **Duplicate Environment**, named
   `sandbox`, then approve the staged changes.
2. Check that its `DATABASE_URL` is the `${{Postgres.DATABASE_URL}}` reference, so it uses the
   sandbox database, and that the volume is mounted at `/app/uploads`.
3. Give it its own domain, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` and `CRON_SECRET`. Remove
   `SMTP_USER` and `SMTP_PASS` so test orders never email real people.
4. Create a project token for the `sandbox` environment.
5. In GitHub, create an environment `sandbox` with the secret `SANDBOXRAILWAYTOKEN` (that token) and
   the variable `APP_URL` = `https://<sandbox domain>`.

The **Scheduled jobs** workflow only calls production. Seed demo data here, never on production: its
accounts share a password that is in this repo.

## Platform admins

A platform admin is a user whose `role` is `admin`. They open `/admin` to see all shops and their
orders, suspend a shop, and read the audit log. No screen creates one and the admin plugin's HTTP
endpoints are blocked (`src/server/auth/auth.ts`), so promote an account directly in that
environment's database:

1. Sign up at `/signup` on that environment. This also creates a shop for the account.
2. Copy the public connection URL of that environment's Postgres (**Connect** tab) and run:

   ```bash
   psql "<public url>" -c "UPDATE \"user\" SET role = 'admin' WHERE email = 'you@example.com';"
   ```

   It should print `UPDATE 1`.
3. Sign out and back in, then open `/admin`.

To remove an admin, run the same command with `role = 'user'`. Each environment has its own users,
so an admin on sandbox is not an admin on production.

## Email and billing

- Email (Gmail SMTP): turn on 2-Step Verification for the Gmail account, create an App Password
  (myaccount.google.com/apppasswords), and set `SMTP_USER` (the Gmail address), `SMTP_PASS` (the
  16-character app password, no spaces) and `MAIL_FROM` (e.g. `StoreLift <that address>`; Gmail
  rewrites any other sender to the account). Gmail allows about 500 emails a day. Without these,
  emails are only logged and review invites wait for the retry job.
- Stripe test mode: create a Pro product with a monthly price, set `STRIPE_SECRET_KEY` and
  `STRIPE_PRICE_PRO`, then add a webhook endpoint `https://<domain>/api/billing/webhook` for
  `checkout.session.completed` and `customer.subscription.deleted` and set `STRIPE_WEBHOOK_SECRET`.
  Locally: `stripe listen --forward-to localhost:3000/api/billing/webhook`.

## Seed demo data or restore a backup

Copy the database's public connection URL (Postgres service → **Connect**) and run locally:

```bash
DATABASE_URL="<public url>" npm run db:seed
gunzip -c mahhali-backup.sql.gz | psql "<public url>"
```
