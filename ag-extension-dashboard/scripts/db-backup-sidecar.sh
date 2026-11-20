#!/bin/sh
# Runs inside the `db-backup` sidecar (postgres image): dumps the app DB on a
# schedule using pg_dump over the network, gzips, prunes by retention.
#
# Off-site copies: when BACKUP_S3_BUCKET is set, each dump is also encrypted
# (AES-256, key from BACKUP_ENCRYPTION_PASSPHRASE) and uploaded to that bucket,
# so losing this server does not lose the data. Any S3-compatible store works
# (AWS S3, Cloudflare R2, Backblaze B2, MinIO) via BACKUP_S3_ENDPOINT.
#
# Env: PGHOST PGUSER PGPASSWORD PGDATABASE
#      BACKUP_INTERVAL_SECONDS (default 86400) BACKUP_RETENTION_DAYS (default 7)
#      BACKUP_S3_BUCKET BACKUP_S3_PREFIX (default db/) BACKUP_S3_ENDPOINT BACKUP_S3_REGION
#      BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY BACKUP_ENCRYPTION_PASSPHRASE
#      BACKUP_S3_RETENTION_DAYS (default 35)
set -eu
BACKUP_DIR="${BACKUP_DIR:-/backups}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION="${BACKUP_RETENTION_DAYS:-7}"
REMOTE_RETENTION="${BACKUP_S3_RETENTION_DAYS:-35}"
PREFIX="${BACKUP_S3_PREFIX:-db/}"
mkdir -p "$BACKUP_DIR"

OFFSITE=0
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
    echo "[db-backup] BACKUP_S3_BUCKET is set but BACKUP_ENCRYPTION_PASSPHRASE is not: refusing to upload unencrypted dumps" >&2
  else
    command -v aws >/dev/null 2>&1 || apk add --no-cache aws-cli openssl >/dev/null
    export AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-}"
    export AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:-}"
    export AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-auto}"
    OFFSITE=1
  fi
fi

s3() {
  if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 "$@"; else aws s3 "$@"; fi
}

upload() {
  ENC="$1.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$1" -out "$ENC" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
  if s3 cp --only-show-errors "$ENC" "s3://${BACKUP_S3_BUCKET}/${PREFIX}$(basename "$ENC")"; then
    echo "[db-backup] off-site ok $(basename "$ENC")"
  else
    echo "[db-backup] off-site upload FAILED for $(basename "$ENC")" >&2
  fi
  rm -f "$ENC"
  # Remote pruning by name date (DB_YYYYMMDD_...): keep REMOTE_RETENTION days.
  CUTOFF=$(date -d "@$(( $(date +%s) - REMOTE_RETENTION * 86400 ))" +%Y%m%d 2>/dev/null || echo "")
  [ -n "$CUTOFF" ] && s3 ls "s3://${BACKUP_S3_BUCKET}/${PREFIX}" | awk '{print $4}' | while read -r NAME; do
    DAY=$(echo "$NAME" | sed -n 's/.*_\([0-9]\{8\}\)_[0-9]\{6\}\.sql\.gz\.enc$/\1/p')
    if [ -n "$DAY" ] && [ "$DAY" -lt "$CUTOFF" ]; then
      s3 rm --only-show-errors "s3://${BACKUP_S3_BUCKET}/${PREFIX}${NAME}" && echo "[db-backup] off-site pruned $NAME"
    fi
  done
  return 0
}

echo "[db-backup] every ${INTERVAL}s, retention ${RETENTION}d, dir ${BACKUP_DIR}, off-site $( [ "$OFFSITE" = 1 ] && echo "s3://${BACKUP_S3_BUCKET}/${PREFIX}" || echo off)"
while true; do
  TS=$(date +"%Y%m%d_%H%M%S")
  OUT="$BACKUP_DIR/${PGDATABASE}_${TS}.sql.gz"
  if pg_dump --no-owner --format=plain "$PGDATABASE" | gzip > "$OUT.tmp"; then
    mv "$OUT.tmp" "$OUT"
    echo "[db-backup] ok $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"
    [ "$OFFSITE" = 1 ] && upload "$OUT"
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+$RETENTION" -print -delete | sed 's/^/[db-backup] pruned /'
  else
    rm -f "$OUT.tmp"
    echo "[db-backup] FAILED at $TS" >&2
  fi
  sleep "$INTERVAL"
done
