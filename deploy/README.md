# Deploying Mahhali

One Linux server (any VPS with 1 to 2 GB of RAM) runs three containers with Docker Compose:
PostgreSQL 16, the Next.js app and Caddy for HTTPS. CI builds the image, pushes it to GitHub
Container Registry and runs `deploy.sh` on the server over SSH.

## One-time server setup

1. Point the domain's A record at the server.
2. Install Docker and the Compose plugin.
3. Create `/opt/mahhali` and copy into it: `docker-compose.prod.yml`, `Caddyfile`, `deploy.sh`, `backup.sh`.
4. Create `/opt/mahhali/.env` from `server.env.example` with real, long random passwords.
5. Log the server in to the registry so it can pull the private image:
   `echo <token with read:packages> | docker login ghcr.io -u <github user> --password-stdin`
6. Add the nightly backup: `0 3 * * * /opt/mahhali/backup.sh` in the deploy user's crontab, and copy
   `/opt/mahhali/backups` off the server.

## Turn on deploys from CI

In the GitHub repository settings:

- Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (a key that only this workflow uses).
- Variables: `DEPLOY_ENABLED` = `true`.

Every merge to `main` then runs the tests, builds the image, and deploys it. Migrations run with
`prisma migrate deploy` before the new app starts.
