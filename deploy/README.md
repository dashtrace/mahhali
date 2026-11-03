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
   | `RESEND_API_KEY`, `MAIL_FROM` | optional, see below |
   | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET` | optional, see below |

6. Turn on backups for the Postgres volume (database service → **Backups**).
7. Create a **project token** (Project Settings → Tokens) for the environment.

## Turn on deploys from CI

In the GitHub repository settings:

- Secrets: `RAILWAY_TOKEN` (the project token), `CRON_SECRET` (same value as on Railway).
- Variables: `APP_URL` = `https://<your domain>`, `DEPLOY_ENABLED` = `true`.

Every merge to `main` then runs the tests and deploys. The **Scheduled jobs** workflow calls
`/api/cron/expire-reservations` and `/api/cron/review-emails` every 10 minutes; run it by hand from
the Actions tab to test it.

## Email and billing

- Email: create a Resend account, verify the sending domain (DNS records; allow a day), and set
  `RESEND_API_KEY` and `MAIL_FROM`. Without a key, emails are only logged and review invites wait
  for the retry job.
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
