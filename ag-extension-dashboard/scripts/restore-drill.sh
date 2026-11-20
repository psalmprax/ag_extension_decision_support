#!/bin/sh
# Restore drill: proves the newest backup can actually be restored. Takes the newest
# dump (off-site when BACKUP_S3_BUCKET is set, else the local backups volume), restores
# it into a throwaway Postgres container, checks that the main tables have rows, and
# removes the container. Nothing touches the live database.
#
# Run on the server from ag-extension-dashboard/:  sh scripts/restore-drill.sh
# Reads the same BACKUP_* variables as the db-backup sidecar from .env.
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
WORK=$(mktemp -d)
NAME="restore-drill-$$"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "[drill] fetching newest off-site dump"
  docker run --rm -v "$WORK:/work" \
    -e AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-}" -e AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:-}" \
    -e AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-auto}" -e BACKUP_ENCRYPTION_PASSPHRASE \
    -e BUCKET="$BACKUP_S3_BUCKET" -e PREFIX="${BACKUP_S3_PREFIX:-db/}" -e ENDPOINT="${BACKUP_S3_ENDPOINT:-}" \
    alpine:3.20 sh -c '
      apk add --no-cache aws-cli openssl >/dev/null
      EP=""; [ -n "$ENDPOINT" ] && EP="--endpoint-url $ENDPOINT"
      LATEST=$(aws $EP s3 ls "s3://$BUCKET/$PREFIX" | awk "{print \$4}" | grep "\.sql\.gz\.enc$" | sort | tail -1)
      [ -n "$LATEST" ] || { echo "[drill] no off-site backups found" >&2; exit 1; }
      echo "[drill] newest: $LATEST"
      aws $EP s3 cp --only-show-errors "s3://$BUCKET/$PREFIX$LATEST" /work/dump.enc
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in /work/dump.enc -out /work/dump.sql.gz -pass env:BACKUP_ENCRYPTION_PASSPHRASE'
else
  echo "[drill] BACKUP_S3_BUCKET not set: using the newest local dump"
  VOLUME=$(docker volume ls --format '{{.Name}}' | grep '_db_backups$' | head -1)
  [ -n "$VOLUME" ] || { echo "[drill] no db_backups volume on this host" >&2; exit 1; }
  docker run --rm -v "$VOLUME:/backups" -v "$WORK:/work" alpine:3.20 \
    sh -c 'cp "$(ls -1 /backups/*.sql.gz | sort | tail -1)" /work/dump.sql.gz'
fi

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
docker cp "$WORK/dump.sql.gz" "$NAME:/tmp/dump.sql.gz"
docker exec "$NAME" sh -c 'gunzip -c /tmp/dump.sql.gz | psql -q -U postgres -d drill -v ON_ERROR_STOP=0 >/dev/null 2>/tmp/restore.err; true'
COUNTS=$(docker exec "$NAME" psql -U postgres -d drill -Atc "SELECT (SELECT COUNT(*) FROM users) || ' users, ' || (SELECT COUNT(*) FROM farmers) || ' farmers, ' || (SELECT COUNT(*) FROM visits) || ' visits'")
echo "[drill] restored: $COUNTS"
USERS=$(echo "$COUNTS" | cut -d' ' -f1)
[ "${USERS:-0}" -gt 0 ] || { echo "[drill] FAILED: the restored database has no users" >&2; exit 1; }
echo "[drill] ok"
