#!/bin/sh
# Runs inside the `db-backup` sidecar (postgres image): dumps the app DB on a
# schedule using pg_dump over the network, gzips, prunes by retention.
# Env: PGHOST PGUSER PGPASSWORD PGDATABASE BACKUP_INTERVAL_SECONDS (default 86400) BACKUP_RETENTION_DAYS (default 7)
set -eu
BACKUP_DIR="${BACKUP_DIR:-/backups}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION="${BACKUP_RETENTION_DAYS:-7}"
mkdir -p "$BACKUP_DIR"

echo "[db-backup] every ${INTERVAL}s, retention ${RETENTION}d, dir ${BACKUP_DIR}"
while true; do
  TS=$(date +"%Y%m%d_%H%M%S")
  OUT="$BACKUP_DIR/${PGDATABASE}_${TS}.sql.gz"
  if pg_dump --no-owner --format=plain "$PGDATABASE" | gzip > "$OUT.tmp"; then
    mv "$OUT.tmp" "$OUT"
    echo "[db-backup] ok $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+$RETENTION" -print -delete | sed 's/^/[db-backup] pruned /'
  else
    rm -f "$OUT.tmp"
    echo "[db-backup] FAILED at $TS" >&2
  fi
  sleep "$INTERVAL"
done
