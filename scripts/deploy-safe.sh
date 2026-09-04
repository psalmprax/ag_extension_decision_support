#!/usr/bin/env bash
# Safe deployment - preserves database and Redis volumes
# Usage: ./scripts/deploy-safe.sh [staging|production]

set -euo pipefail

ENV="${1:-production}"
PROJECT_DIR="ag-extension-dashboard"
COMPOSE_PROJECT_NAME="ag-extension-dashboard"

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
docker compose -p ${COMPOSE_PROJECT_NAME} \
    --env-file .env \
    -f ${PROJECT_DIR}/docker-compose.yml \
    -f ${PROJECT_DIR}/docker-compose.${COMPOSE_SUFFIX}.yml \
    -f ${PROJECT_DIR}/docker-compose.agents.yml \
    stop backend frontend 2>/dev/null || true

# 4. Remove ONLY application containers (preserve volumes)
echo "🗑️  Removing old application containers..."
docker compose -p ${COMPOSE_PROJECT_NAME} \
    --env-file .env \
    -f ${PROJECT_DIR}/docker-compose.yml \
    -f ${PROJECT_DIR}/docker-compose.${COMPOSE_SUFFIX}.yml \
    -f ${PROJECT_DIR}/docker-compose.agents.yml \
    rm -f backend frontend 2>/dev/null || true
docker rm -f ag-discovery-scraper ag-agent-zero ag-crew-ai 2>/dev/null || true

# 5. Build new images
echo "🏗️ Building new images..."
docker compose -p ${COMPOSE_PROJECT_NAME} \
    --env-file .env \
    -f ${PROJECT_DIR}/docker-compose.yml \
    -f ${PROJECT_DIR}/docker-compose.${COMPOSE_SUFFIX}.yml \
    -f ${PROJECT_DIR}/docker-compose.agents.yml \
    build backend frontend

# 6. Start application services (db/redis/traefik stay running)
echo "▶️  Starting application services..."
docker compose -p ${COMPOSE_PROJECT_NAME} \
    --env-file .env \
    -f ${PROJECT_DIR}/docker-compose.yml \
    -f ${PROJECT_DIR}/docker-compose.${COMPOSE_SUFFIX}.yml \
    -f ${PROJECT_DIR}/docker-compose.agents.yml \
    up -d --no-deps backend frontend

# 7. Verification
echo "⌛ Waiting for services to stabilize (15s)..."
sleep 15

echo "📊 Current Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ag-

# Health checks
echo ""
echo "🏥 Health Checks:"
if docker exec ag-dashboard-backend wget -q --spider http://localhost:3001/health 2>/dev/null; then
    echo "  ✅ Backend healthy"
else
    echo "  ❌ Backend unhealthy"
fi

if docker exec ag-dashboard-frontend wget -q --spider http://localhost:80 2>/dev/null; then
    echo "  ✅ Frontend healthy"
else
    echo "  ❌ Frontend unhealthy"
fi

echo ""
echo "✅ Safe Deployment Complete!"
echo "📦 Database and Redis data preserved."