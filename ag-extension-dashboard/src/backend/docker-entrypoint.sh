#!/bin/sh
# Backend container entrypoint: apply pending Prisma migrations, then start.
# Set SKIP_MIGRATIONS=true for read-only replicas or when migrations are run by CI.
set -e

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "[entrypoint] applying database migrations (prisma migrate deploy)…"
  # Retry: the DB container may still be starting despite the healthcheck.
  n=0
  MIGRATION_DONE=0
  until [ "$MIGRATION_DONE" -eq 1 ]; do
    if OUTPUT=$(npx prisma migrate deploy 2>&1); then
      echo "$OUTPUT"
      echo "[entrypoint] migrations successfully applied."
      MIGRATION_DONE=1
      break
    fi

    echo "$OUTPUT"
    n=$((n+1))

    # Schema failures need an operator to inspect and repair the actual database.
    if echo "$OUTPUT" | grep -qE '(already exists|P3005|P3009|P3018)'; then
      echo "[entrypoint] migration requires manual repair; refusing to mark unapplied SQL as applied" >&2
      exit 1
    fi

    if [ "$n" -ge 10 ]; then
      echo "[entrypoint] migrations failed after $n attempts — refusing to start with a stale schema" >&2
      exit 1
    fi
    echo "[entrypoint] migrate deploy failed (attempt $n), retrying in 5s…"
    sleep 5
  done
fi

exec "$@"
