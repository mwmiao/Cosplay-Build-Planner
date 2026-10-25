#!/bin/sh
# Prepares /app/data, backs up the database, applies migrations, then starts the
# app as PUID:PGID (so files on the NAS share are owned by your NAS user).
set -e

DATA_DIR=/app/data
mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/backups" "$DATA_DIR/secrets"
chmod 700 "$DATA_DIR/secrets" 2>/dev/null || true

if [ "$(id -u)" = "0" ]; then
  chown -R "$PUID:$PGID" "$DATA_DIR"
  RUN_AS="setpriv --reuid=$PUID --regid=$PGID --clear-groups"
else
  RUN_AS=""
fi

if [ -z "$REGISTRATION_CODE" ]; then
  echo "Registration is closed (no REGISTRATION_CODE set). Existing accounts can still log in."
fi
if [ -z "$APP_URL" ]; then
  echo "APP_URL is not set: password-reset links and secure cookies need it (see README)."
fi

# Snapshot the existing database before migrating. Nothing is ever seeded,
# reset or deleted on startup.
if [ -f "$DATA_DIR/cosplay.db" ]; then
  $RUN_AS node /app/scripts/backup.mjs || echo "WARNING: pre-start backup failed" >&2
fi

echo "Applying database migrations..."
$RUN_AS node /app/node_modules/prisma/build/index.js migrate deploy --schema /app/prisma/schema.prisma

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
