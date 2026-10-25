#!/bin/sh
# Prepares /app/data, backs up the database, applies migrations, then starts the
# app as PUID:PGID (so files on the NAS share are owned by your NAS user).
set -e

DATA_DIR=/app/data
mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/backups"

if [ "$(id -u)" = "0" ]; then
  chown -R "$PUID:$PGID" "$DATA_DIR"
  RUN_AS="setpriv --reuid=$PUID --regid=$PGID --clear-groups"
else
  RUN_AS=""
fi

if [ -z "$APP_PASSWORD" ] || [ -z "$SESSION_SECRET" ]; then
  echo "ERROR: APP_PASSWORD and SESSION_SECRET must be set (see .env.example)." >&2
  exit 1
fi

# Snapshot the existing database before migrating; seed only on the very first run.
FIRST_RUN=true
if [ -f "$DATA_DIR/cosplay.db" ]; then
  FIRST_RUN=false
  $RUN_AS node /app/scripts/backup.mjs || echo "WARNING: pre-start backup failed" >&2
fi

echo "Applying database migrations..."
$RUN_AS node /app/node_modules/prisma/build/index.js migrate deploy --schema /app/prisma/schema.prisma

if [ "$FIRST_RUN" = "true" ] && [ "${SEED_EXAMPLE:-true}" = "true" ]; then
  $RUN_AS node /app/prisma/seed.js
fi

# Periodic database backups while the container runs.
HOURS="${BACKUP_INTERVAL_HOURS:-24}"
if [ "$HOURS" -gt 0 ] 2>/dev/null; then
  (
    while sleep "$((HOURS * 3600))"; do
      $RUN_AS node /app/scripts/backup.mjs || echo "WARNING: scheduled backup failed" >&2
    done
  ) &
fi

echo "Starting Cosplay Build Planner on port ${PORT}..."
exec $RUN_AS "$@"
