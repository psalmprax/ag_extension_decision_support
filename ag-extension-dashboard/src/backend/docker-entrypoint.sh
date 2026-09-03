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

    # P3005: database not empty (e.g. spatial_ref_sys from postgis or existing tables without _prisma_migrations)
    if echo "$OUTPUT" | grep -q "P3005"; then
      echo "[entrypoint] P3005 detected — baselining existing database to 0_init..."
      mkdir -p prisma/migrations/0_init
      npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
      npx prisma migrate resolve --applied 0_init || true
      continue
    fi

    # P3009/P3018: failed migration in target database or collision
    if echo "$OUTPUT" | grep -qE "(already exists|P3018|P3009)"; then
      FAILED_MIG=$(echo "$OUTPUT" | grep -oE "Migration name: [0-9]+_[a-zA-Z0-9_]+" | cut -d" " -f3 || true)
      if [ -z "$FAILED_MIG" ]; then
        FAILED_MIG=$(echo "$OUTPUT" | grep -oE "The \`[0-9]+_[a-zA-Z0-9_]+\` migration started at" | cut -d"\`" -f2 || true)
      fi
      if [ -n "$FAILED_MIG" ]; then
        echo "[entrypoint] Schema collision / failed migration detected for $FAILED_MIG. Resolving as applied..."
        npx prisma migrate resolve --applied "$FAILED_MIG" || true
        continue
      fi
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
