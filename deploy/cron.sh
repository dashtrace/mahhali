#!/usr/bin/env bash
# Calls one of the app's scheduled jobs. From the deploy user's crontab:
#   */15 * * * * /opt/mahhali/cron.sh expire-reservations
#   */10 * * * * /opt/mahhali/cron.sh review-emails
set -euo pipefail
cd /opt/mahhali
set -a; source .env; set +a
curl -fsS -X POST -H "x-cron-secret: ${CRON_SECRET}" "https://${DOMAIN}/api/cron/$1" > /dev/null
