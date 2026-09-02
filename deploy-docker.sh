#!/bin/bash
# AG Extension Decision Support - Manual Deployment Script
# This script bypasses Jenkins and performs a "Deep Clean" deployment directly.

set -e

PROJECT_DIR="ag-extension-dashboard"
COMPOSE_PROJECT_NAME="ag-extension-dashboard"

echo "🚀 Starting Manual Deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest changes from stage (Root)..."
git fetch origin stage
git reset --hard origin/stage

# Update nested repository if it exists (Fix for stale builds)
if [ -d "ag-extension-dashboard" ] && [ -d "ag-extension-dashboard/.git" ]; then
    echo "📥 Updating NESTED repository clone..."
    pushd ag-extension-dashboard > /dev/null
    git fetch origin stage
    git reset --hard origin/stage
    popd > /dev/null
else
    echo "⚠️  Nested repository not found or not a git repo, skipping nested sync."
fi

# 2. Create network if missing
echo "🌐 Ensuring docker network exists..."
docker network create ag-network || true

# 2.5 Force Remove conflicting containers (Hardening)
echo "🛡️ Cleaning up any conflicting container names..."
docker rm -f ag-dashboard-db ag-dashboard-redis ag-dashboard-backend ag-dashboard-frontend ag-crew-ai ag-agent-zero ag-traefik || true

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
docker exec ag-dashboard-backend npx prisma db seed || echo "⚠️ Seed check completed."

# 5. Verification
echo "⌛ Waiting for services to stabilize (10s)..."
sleep 10
echo "📊 Current Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ag-

echo "✅ Deployment Complete! Please check for v1.0.2 [Hardened] in the UI."
