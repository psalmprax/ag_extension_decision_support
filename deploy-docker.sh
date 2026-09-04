#!/bin/bash
# AG Extension Decision Support - Manual Deployment Script
# This script bypasses Jenkins and performs a "Deep Clean" deployment directly.

set -e

PROJECT_DIR="ag-extension-dashboard"
COMPOSE_PROJECT_NAME="ag-extension-dashboard"

echo "🚀 Starting Manual Deployment..."

# 0. Safety: refuse to run on a dirty tree. `git reset --hard` silently discards
#    uncommitted work (including a hand-edited .env). Operators must commit/stash first.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "❌ Working tree has uncommitted changes. Commit or stash before deploying." >&2
    git status --short
    exit 1
fi

# 1. Fast-forward to the deploy branch (no history rewrite)
DEPLOY_BRANCH="${DEPLOY_BRANCH:-stage}"
echo "📥 Fast-forwarding to origin/${DEPLOY_BRANCH}..."
git fetch origin "$DEPLOY_BRANCH"
git checkout -q "$DEPLOY_BRANCH"
if ! git merge --ff-only "origin/$DEPLOY_BRANCH"; then
    echo "❌ Local ${DEPLOY_BRANCH} has diverged from origin. Resolve manually — this script will not force-reset." >&2
    exit 1
fi

# Update nested repository if it exists (Fix for stale builds)
if [ -d "ag-extension-dashboard" ] && [ -d "ag-extension-dashboard/.git" ]; then
    echo "📥 Updating NESTED repository clone (ff-only)..."
    pushd ag-extension-dashboard > /dev/null
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
        echo "❌ Nested repo has uncommitted changes; aborting." >&2; popd > /dev/null; exit 1
    fi
    git fetch origin "$DEPLOY_BRANCH"
    git checkout -q "$DEPLOY_BRANCH"
    git merge --ff-only "origin/$DEPLOY_BRANCH" || { echo "❌ Nested repo diverged; aborting." >&2; popd > /dev/null; exit 1; }
    popd > /dev/null
else
    echo "⚠️  Nested repository not found or not a git repo, skipping nested sync."
fi

# 1.5 Pre-deploy backup of the database (cheap insurance before schema migrations run)
if docker ps --format '{{.Names}}' | grep -q '^ag-dashboard-db$'; then
    BK_DIR="${BACKUP_DIR:-./backups}"; mkdir -p "$BK_DIR"
    BK_FILE="$BK_DIR/pre-deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
    echo "🐘 Taking pre-deploy backup → $BK_FILE"
    if ! docker exec ag-dashboard-db pg_dump -U "${DATABASE_USER:-postgres}" "${DATABASE_NAME:-ag_extension}" | gzip > "$BK_FILE"; then
        echo "❌ Pre-deploy backup failed; aborting deploy." >&2; exit 1
    fi
fi

# 2. Create network if missing
echo "🌐 Ensuring docker network exists..."
docker network create ag-network || true

# 2.5 Containers are stopped via compose below. We deliberately do NOT `docker rm -f`
#     the database container by name: compose `down` is the only lifecycle owner, and
#     volumes are never removed.

# 3. Clean containers (NEVER delete volumes — that wipes the production database)
echo "🧹 Stopping and removing containers (volumes preserved)..."
docker compose -p ${COMPOSE_PROJECT_NAME} \
    --env-file .env \
    -f ${PROJECT_DIR}/docker-compose.yml \
    -f ${PROJECT_DIR}/docker-compose.prod.yml \
    -f ${PROJECT_DIR}/docker-compose.agents.yml \
    down --remove-orphans || true

# 4. Deploy with build
echo "🏗️ Building and Starting Containers..."
docker compose -p ${COMPOSE_PROJECT_NAME} \
    --env-file .env \
    -f ${PROJECT_DIR}/docker-compose.yml \
    -f ${PROJECT_DIR}/docker-compose.prod.yml \
    -f ${PROJECT_DIR}/docker-compose.agents.yml \
    up -d --build --force-recreate

# 4.5 Idempotent Database Seed Check & Population
echo "🌱 Checking Database Seed Status (Populating if Empty)..."
if ! docker exec ag-dashboard-backend npx prisma db seed; then
    echo "❌ Database seed failed — inspect 'docker logs ag-dashboard-backend'." >&2
    exit 1
fi

# 5. Verification
echo "⌛ Waiting for services to stabilize (10s)..."
sleep 10
echo "📊 Current Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ag-

# 6. Health gate: fail the deploy if the API does not come up healthy.
HEALTH_URL="${HEALTH_URL:-http://localhost:7500/health}"
for i in $(seq 1 24); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
        echo "✅ Deployment Complete — API healthy at $HEALTH_URL"
        exit 0
    fi
    sleep 5
done
echo "❌ API did not become healthy at $HEALTH_URL within 2 minutes." >&2
docker logs --tail 100 ag-dashboard-backend >&2 || true
exit 1
