#!/bin/bash

# ==============================================================================
# AG-Extension CI/CD Manager
# ==============================================================================
# This script manages branch-based deployment logic using SSH.
# It mimics the logic used in GitHub Actions for local/manual control.
#
# Usage:
#   ./scripts/ci-manager.sh [branch_name]
# ==============================================================================

BRANCH=${1:-$(git branch --show-current)}

# Configuration
TEST_SERVER="149.104.110.122"
TEST_KEY="/home/psalmprax/Music/id_rsa"

PROD_SERVER="145.223.97.248"
PROD_KEY="/home/psalmprax/Videos/id_key"

REMOTE_PATH="/root/ag_extension_decision_support/ag-extension-dashboard"

echo "🔍 Detected Branch: $BRANCH"

if [[ "$BRANCH" == "master" ]]; then
    echo "🎯 Targeting PRODUCTION (New Server: $PROD_SERVER)"
    SERVER=$PROD_SERVER
    KEY=$PROD_KEY
    DEPLOY_CMD="./scripts/orchestrate-migration.sh deploy"
elif [[ "$BRANCH" == "stage" || "$BRANCH" == feature/* ]]; then
    echo "🧪 Targeting TESTING (Old Server: $TEST_SERVER)"
    SERVER=$TEST_SERVER
    KEY=$TEST_KEY
    DEPLOY_CMD="docker compose -f docker-compose.yml -f docker-compose.agents.yml up -d --build"
else
    echo "⚠️ Unknown branch '$BRANCH'. No deployment rules defined."
    exit 1
fi

echo "🚀 Deploying to $SERVER..."

ssh -i "$KEY" -o StrictHostKeyChecking=no -o PasswordAuthentication=no root@"$SERVER" << EOF
    cd $REMOTE_PATH
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
    $DEPLOY_CMD
    docker image prune -f
EOF

echo "✅ Done."
