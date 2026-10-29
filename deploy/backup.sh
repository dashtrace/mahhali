#!/usr/bin/env bash
# Nightly from cron: 0 3 * * * /opt/mahhali/backup.sh
# Copy the backups directory off the server (rclone, scp...) so a dead disk is not the end.
set -euo pipefail
cd /opt/mahhali
set -a; source .env; set +a
mkdir -p backups
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "backups/mahhali-$(date +%F).sql.gz"
find backups -name '*.sql.gz' -mtime +14 -delete
