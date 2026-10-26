# Deploying Mahhali

One Linux server (any VPS with 1 to 2 GB of RAM) runs three containers with Docker Compose:
PostgreSQL 16, the Next.js app and Caddy for HTTPS. CI builds the image, pushes it to GitHub
Container Registry and runs `deploy.sh` on the server over SSH.

## One-time server setup

1. Point the domain's A record at the server.
2. Install Docker and the Compose plugin.
3. Create `/opt/mahhali` and copy into it: `docker-compose.prod.yml`, `Caddyfile`, `deploy.sh`, `backup.sh`, `cron.sh`.
4. Create `/opt/mahhali/.env` from `server.env.example` with real, long random passwords.
5. Log the server in to the registry so it can pull the private image:
   `echo <token with read:packages> | docker login ghcr.io -u <github user> --password-stdin`
6. Add the scheduled jobs and the nightly backup to the deploy user's crontab, and copy
   `/opt/mahhali/backups` off the server:

   ```
   */15 * * * * /opt/mahhali/cron.sh expire-reservations
   */10 * * * * /opt/mahhali/cron.sh review-emails
   0 3 * * *    /opt/mahhali/backup.sh
   ```

## Email and billing

- Email: create a Resend account, verify the sending domain (DNS records; allow a day), and set
  `RESEND_API_KEY` and `MAIL_FROM`. Without a key, emails are only logged and review invites wait
  for the retry job.
- Stripe test mode: create a Pro product with a monthly price, set `STRIPE_SECRET_KEY` and
  `STRIPE_PRICE_PRO`, then add a webhook endpoint `https://<domain>/api/billing/webhook` for
  `checkout.session.completed` and `customer.subscription.deleted` and set `STRIPE_WEBHOOK_SECRET`.
  Locally: `stripe listen --forward-to localhost:3000/api/billing/webhook`.

## Restore from a backup

```bash
cd /opt/mahhali
docker compose -f docker-compose.prod.yml up -d db
gunzip -c backups/mahhali-YYYY-MM-DD.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
docker compose -f docker-compose.prod.yml up -d
```

## Turn on deploys from CI

In the GitHub repository settings:

- Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (a key that only this workflow uses).
- Variables: `DEPLOY_ENABLED` = `true`.

Every merge to `main` then runs the tests, builds the image, and deploys it. Migrations run with
`prisma migrate deploy` before the new app starts.
