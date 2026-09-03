#!/bin/sh
# Backend container entrypoint: apply pending Prisma migrations, then start.
# Set SKIP_MIGRATIONS=true for read-only replicas or when migrations are run by CI.
set -e

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "[entrypoint] applying database migrations (prisma migrate deploy)…"
  # Retry: the DB container may still be starting despite the healthcheck.
  n=0
  until npx prisma migrate deploy; do
    n=$((n+1))
    if [ "$n" -ge 10 ]; then
      echo "[entrypoint] migrations failed after $n attempts — refusing to start with a stale schema" >&2
      exit 1
    fi
    echo "[entrypoint] migrate deploy failed (attempt $n), retrying in 5s…"
    sleep 5
  done
fi

exec "$@"
