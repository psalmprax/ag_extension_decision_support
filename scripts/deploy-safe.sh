#!/usr/bin/env bash
# Safe deployment - preserves database and Redis volumes
# Usage: ./scripts/deploy-safe.sh [staging|production]
#
# Exit codes: 0 = deployed and healthy, 1 = any health gate failed.
# A failed health check must never be reported as a successful deploy.

set -euo pipefail

ENV="${1:-production}"
PROJECT_DIR="ag-extension-dashboard"
COMPOSE_PROJECT_NAME="ag-extension-dashboard"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-60}"

# Map environment to compose file suffix
case "$ENV" in
    production|prod)
        COMPOSE_SUFFIX="prod"
        ;;
    staging|stage)
        COMPOSE_SUFFIX="staging"
        ;;
    *)
        COMPOSE_SUFFIX="$ENV"
        ;;
esac

COMPOSE_ARGS=(
    -p "$COMPOSE_PROJECT_NAME"
    --env-file .env
    -f "$PROJECT_DIR/docker-compose.yml"
    -f "$PROJECT_DIR/docker-compose.$COMPOSE_SUFFIX.yml"
    -f "$PROJECT_DIR/docker-compose.agents.yml"
)

echo "🚀 Starting Safe Deployment (env: $ENV, compose: $COMPOSE_SUFFIX)..."
echo "📦 Preserving: postgres_data, redis_data volumes"

# 1. Pull latest changes
echo "📥 Pulling latest changes..."
git fetch origin stage
git reset --hard origin/stage

# Update nested repository if it exists
if [ -d "$PROJECT_DIR" ] && [ -d "$PROJECT_DIR/.git" ]; then
    echo "📥 Updating nested repository..."
    pushd "$PROJECT_DIR" > /dev/null
    git fetch origin stage
    git reset --hard origin/stage
    popd > /dev/null
fi

# 2. Ensure network exists
echo "🌐 Ensuring docker network exists..."
docker network create ag-network || true

# 3. Stop ONLY application containers (preserve db, redis, traefik)
echo "🛑 Stopping application services only..."
docker compose "${COMPOSE_ARGS[@]}" stop backend frontend 2>/dev/null || true

# 4. Remove ONLY application containers (preserve volumes)
echo "🗑️  Removing old application containers..."
docker compose "${COMPOSE_ARGS[@]}" rm -f backend frontend 2>/dev/null || true
docker rm -f ag-discovery-scraper ag-agent-zero ag-crew-ai 2>/dev/null || true

# 5. Build new images
echo "🏗️ Building new images..."
docker compose "${COMPOSE_ARGS[@]}" build backend frontend

# 6. Start application services (db/redis/traefik stay running)
echo "▶️  Starting application services..."
docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps backend frontend

# 7. Verification — a failed gate exits 1 so callers/CI see the deploy failed.
echo "⌛ Waiting for services to stabilize (15s)..."
sleep 15

echo "📊 Current Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ag- || true

wait_for() {
    # $1 = label, $2.. = probe command (run via docker exec)
    local label="$1"; shift
    local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
    while [ "$SECONDS" -lt "$deadline" ]; do
        if docker exec "$@" 2>/dev/null; then
            echo "  ✅ $label healthy"
            return 0
        fi
        sleep 3
    done
    echo "  ❌ $label unhealthy after ${HEALTH_TIMEOUT_SECONDS}s"
    return 1
}

echo ""
echo "🏥 Health Checks:"

HEALTH_OK=0
# Node's native fetch inside the container: slim images may not ship wget/curl
# (see CLAUDE.md "Container-Independent Probes").
wait_for "Backend" ag-dashboard-backend \
    node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    || HEALTH_OK=1
wait_for "Frontend" ag-dashboard-frontend \
    node -e "fetch('http://localhost:80/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    || HEALTH_OK=1

if [ "$HEALTH_OK" -ne 0 ]; then
    echo ""
    echo "❌ Safe Deployment FAILED health gates — reporting failure (backend/frontend may still be restarting; re-run the checks before trusting this deploy)."
    exit 1
fi

echo ""
echo "✅ Safe Deployment Complete! Health gates passed."
echo "📦 Database and Redis data preserved."
