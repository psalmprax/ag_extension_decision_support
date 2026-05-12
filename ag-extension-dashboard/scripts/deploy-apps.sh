#!/bin/bash
# Script to deploy applications without touching DB/Redis

echo "🚀 Starting Application Deployment (Skipping DB/Redis)"
cd /root/ag_extension_decision_support/ag-extension-dashboard

# Pull latest changes from the stage branch
echo "📥 Pulling latest changes from stage branch..."
git pull origin stage

# Build and deploy only the application containers
echo "🏗️ Building and Starting Application Containers..."
docker compose -p ag-extension \
    --env-file .env \
    -f docker-compose.yml \
    -f docker-compose.agents.yml \
    up -d --build backend frontend agent-zero crew-ai

# Verification
echo "⌛ Waiting for services to stabilize (10s)..."
sleep 10
echo "📊 Current Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ag-

echo "✅ Application Deployment Complete!"
