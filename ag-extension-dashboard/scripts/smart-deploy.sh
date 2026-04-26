#!/bin/bash

# Configuration
REMOTE_HOST="149.104.110.122"
SSH_KEY="/home/psalmprax/Music/id_rsa"
REMOTE_PATH="/root/ag-extension-dashboard/ag-extension-dashboard"

echo "----------------------------------------------------"
echo "🚀 Starting Smart Deployment Workflow"
echo "----------------------------------------------------"

# 1. Local Git Sync
echo "📝 Step 1: Committing and pushing local changes..."
git add .
git commit -m "Auto-deploy: Multimodal RAG Hardening & Smart Deploy [$(date '+%Y-%m-%d %H:%M:%S')]"
git push origin master
if [ $? -ne 0 ]; then
    echo "❌ Git push failed. Aborting deployment."
    exit 1
fi

# 2. Remote Deployment
echo "🌐 Step 2: Connecting to remote server ($REMOTE_HOST)..."
ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o PasswordAuthentication=no root@$REMOTE_HOST << EOF
    cd $REMOTE_PATH
    echo "📥 Pulling latest changes from master..."
    git pull origin master
    
    echo "🔍 Checking database and redis availability..."
    # Check if containers are running
    DB_STATUS=\$(docker ps --filter "name=ag-dashboard-db" --filter "status=running" -q)
    REDIS_STATUS=\$(docker ps --filter "name=ag-dashboard-redis" --filter "status=running" -q)
    
    if [ -n "\$DB_STATUS" ] && [ -n "\$REDIS_STATUS" ]; then
        echo "✅ Postgres and Redis are UP. Deploying backend and frontend only..."
        docker compose up -d --build backend frontend
        docker compose -f docker-compose.agents.yml up -d --build 
    else
        echo "⚠️ Postgres or Redis is DOWN/Missing. Performing FULL deployment..."
        docker compose up -d --build
        docker compose -f docker-compose.agents.yml up -d --build 
    fi
    
    echo "🧹 Cleaning up unused Docker resources..."
    docker image prune -f
    
    echo "📊 Current Container Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF

echo "----------------------------------------------------"
echo "🎉 Deployment Process Finished Successfully!"
echo "----------------------------------------------------"
