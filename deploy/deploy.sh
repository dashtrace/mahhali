#!/usr/bin/env bash
# Run on the server by CI: pull the new image, migrate, restart.
set -euo pipefail
cd /opt/mahhali
export APP_TAG="${1:-latest}"
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml run --rm app prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
