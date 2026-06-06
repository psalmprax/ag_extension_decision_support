#!/bin/bash

# Configuration — all values must come from environment variables
REMOTE_HOST="${REMOTE_HOST:?REMOTE_HOST is required}"
SSH_KEY="${SSH_KEY_PATH:?SSH_KEY_PATH is required}"
REMOTE_PATH="${REMOTE_PATH:-/root/ag_extension_decision_support/ag-extension-dashboard}"

echo "----------------------------------------------------"
echo "Starting Smart Deployment Workflow"
echo "----------------------------------------------------"

# 1. Ensure clean state
if [ -n "$(git status --porcelain)" ]; then
    echo "WARNING: Uncommitted changes in working tree. Commit or stash before deploying."
    exit 1
fi

echo "Pushing latest to stage..."
git push origin stage
if [ $? -ne 0 ]; then
    echo "Git push failed. Aborting deployment."
    exit 1
fi

# 2. Remote Deployment
echo "Connecting to remote server ($REMOTE_HOST)..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o PasswordAuthentication=no root@"$REMOTE_HOST" << EOF
    cd $REMOTE_PATH
    echo "Force-syncing to remote stage..."
    git fetch origin
    git reset --hard origin/stage

    echo "Checking database and redis availability..."
    DB_STATUS=\$(docker ps --filter "name=ag-dashboard-db" --filter "status=running" -q)
    REDIS_STATUS=\$(docker ps --filter "name=ag-dashboard-redis" --filter "status=running" -q)

    if [ -n "\$DB_STATUS" ] && [ -n "\$REDIS_STATUS" ]; then
        echo "Postgres and Redis are UP. Running migrations + deploying app services..."
        docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.agents.yml run --rm backend bash -c "
            if npx prisma migrate deploy 2>&1; then
              echo 'Migrations up to date.';
            elif npx prisma migrate deploy 2>&1 | grep -q P3005; then
              echo 'P3005 detected — baselining existing database...';
              mkdir -p prisma/migrations/0_init;
              npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql;
              npx prisma migrate resolve --applied 0_init;
              echo 'Baseline applied. Running migrate deploy...';
              npx prisma migrate deploy;
            else
              echo 'migrate deploy failed (non-P3005). Aborting.' >&2;
              exit 1;
            fi
        "
        docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.agents.yml up -d --build backend frontend agent-zero crew-ai
    else
        echo "Postgres or Redis is DOWN/Missing. Sequential deploy: infra first, then app services..."
        # Build/start infrastructure first (slow builds, avoid CPU contention)
        docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.agents.yml up -d --build app-db redis
        # Then build/start app services
        docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.agents.yml up -d --build backend frontend agent-zero crew-ai
    fi

    echo "Cleaning up unused Docker resources..."
    docker image prune -f

    echo "Current Container Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF

echo "----------------------------------------------------"
echo "Deployment Process Finished Successfully!"
echo "----------------------------------------------------"
