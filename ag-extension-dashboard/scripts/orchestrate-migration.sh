#!/bin/bash

# ==============================================================================
# AG-Extension Orchestration & Migration Script (Universal Cloud-Agnostic)
# ==============================================================================
# This script automates the deployment and data migration between servers.
# It supports both Docker-based databases and Cloud-Managed databases (RDS/Azure/GCP).
#
# Usage:
#   ./scripts/orchestrate-migration.sh deploy          - Sync code and update containers
#   ./scripts/orchestrate-migration.sh migrate-data    - Copy DBs and volumes (Docker-to-Docker)
#   ./scripts/orchestrate-migration.sh migrate-cloud   - Migrate between Cloud DBs (RDS-to-RDS)
#   ./scripts/orchestrate-migration.sh docker-to-cloud - Migrate from Local Docker to Cloud DB
#   ./scripts/orchestrate-migration.sh extract-redis   - Extract Redis RDB for Cloud Upload
# ==============================================================================

# --- Configuration ---
SOURCE_HOST=${SOURCE_HOST:-"149.104.110.122"}
SOURCE_KEY=${SOURCE_KEY:-"/home/psalmprax/Music/id_rsa"}
DEST_HOST=${DEST_HOST:-"145.223.97.248"}
DEST_KEY=${DEST_KEY:-"/home/psalmprax/Videos/id_key"}
REMOTE_PATH="/root/ag_extension_decision_support/ag-extension-dashboard"

# Docker Names
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.agents.yml"
BACKEND_CONTAINER="ag-dashboard-backend"
DB_CONTAINER="ag-dashboard-db"
REDIS_CONTAINER="ag-dashboard-redis"

# Volume Names
VOLUME_PREFIX="ag-extension-dashboard"
REDIS_VOL="${VOLUME_PREFIX}_redis_data"
POSTGRES_VOL="${VOLUME_PREFIX}_postgres_data"
AGENT_ZERO_VOL="${VOLUME_PREFIX}_agent-zero-data"
CREW_AI_VOL="${VOLUME_PREFIX}_crew-ai-data"

# Cloud Database Configuration
DB_NAME=${DB_NAME:-"ag_extension"}
DB_USER=${DB_USER:-"postgres"}
DB_PASS=${DB_PASS:-"password"}
SRC_DB_ENDPOINT=${SRC_DB_ENDPOINT:-""} 
DST_DB_ENDPOINT=${DST_DB_ENDPOINT:-""} 

# --- SSH Helpers ---
src_ssh() { ssh -i "$SOURCE_KEY" -o StrictHostKeyChecking=no -o PasswordAuthentication=no root@"$SOURCE_HOST" "$@"; }
dest_ssh() { ssh -i "$DEST_KEY" -o StrictHostKeyChecking=no -o PasswordAuthentication=no root@"$DEST_HOST" "$@"; }

# --- Functions ---

deploy_code() {
    echo "----------------------------------------------------"
    echo "🚀 Deploying latest code to $DEST_HOST..."
    echo "----------------------------------------------------"
    dest_ssh "cd $REMOTE_PATH && git pull origin master"
    echo "🔍 Checking database status..."
    DB_UP=$(dest_ssh "docker ps --filter 'name=$DB_CONTAINER' --filter 'status=running' -q")
    REDIS_UP=$(dest_ssh "docker ps --filter 'name=$REDIS_CONTAINER' --filter 'status=running' -q")

    if [ -z "$DB_UP" ] || [ -z "$REDIS_UP" ]; then
        echo "⚠️  Database or Redis is DOWN. Performing FULL deployment..."
        dest_ssh "cd $REMOTE_PATH && docker compose $COMPOSE_FILES up -d --build"
    else
        echo "✅ Databases are already running. Deploying APPLICATION services only..."
        dest_ssh "cd $REMOTE_PATH && docker compose $COMPOSE_FILES up -d --build backend frontend agent-zero crew-ai"
    fi
    dest_ssh "docker image prune -f"
    echo "✅ Code deployment finished."
}

# --- Option A: Docker-to-Docker Migration ---
migrate_postgres_docker() {
    echo "🐘 Migrating Postgres (Docker -> Docker)..."
    src_ssh "docker exec $DB_CONTAINER pg_dumpall -U postgres > /root/pg_migration.sql"
    scp -i "$SOURCE_KEY" -o StrictHostKeyChecking=no root@"$SOURCE_HOST":/root/pg_migration.sql ./pg_migration.sql
    scp -i "$DEST_KEY" -o StrictHostKeyChecking=no ./pg_migration.sql root@"$DEST_HOST":/root/pg_migration.sql
    
    dest_ssh "docker exec $DB_CONTAINER psql -U postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();\""
    dest_ssh "docker exec $DB_CONTAINER dropdb -U postgres --if-exists $DB_NAME"
    dest_ssh "docker exec $DB_CONTAINER createdb -U postgres $DB_NAME"
    dest_ssh "cat /root/pg_migration.sql | docker exec -i $DB_CONTAINER psql -U postgres"
    
    src_ssh "rm /root/pg_migration.sql"
    dest_ssh "rm /root/pg_migration.sql"
    rm ./pg_migration.sql
}

# --- Option B: Cloud-to-Cloud Migration ---
migrate_postgres_cloud() {
    echo "☁️  Migrating Postgres (Cloud -> Cloud)..."
    if [ -z "$SRC_DB_ENDPOINT" ] || [ -z "$DST_DB_ENDPOINT" ]; then
        echo "❌ Error: SRC_DB_ENDPOINT and DST_DB_ENDPOINT must be set."
        exit 1
    fi
    PGPASSWORD="$DB_PASS" pg_dump -h "$SRC_DB_ENDPOINT" -U "$DB_USER" "$DB_NAME" > cloud_migration.sql
    PGPASSWORD="$DB_PASS" psql -h "$DST_DB_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" < cloud_migration.sql
    rm cloud_migration.sql
}

# --- Option C: Docker-to-Cloud Migration ---
migrate_docker_to_cloud() {
    echo "🚀 Migrating Postgres (Docker Source -> Cloud Target)..."
    if [ -z "$DST_DB_ENDPOINT" ]; then
        echo "❌ Error: DST_DB_ENDPOINT must be set for cloud target."
        exit 1
    fi
    src_ssh "docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME > /root/docker_to_cloud.sql"
    scp -i "$SOURCE_KEY" -o StrictHostKeyChecking=no root@"$SOURCE_HOST":/root/docker_to_cloud.sql ./docker_to_cloud.sql
    PGPASSWORD="$DB_PASS" psql -h "$DST_DB_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" < docker_to_cloud.sql
    src_ssh "rm /root/docker_to_cloud.sql"
    rm docker_to_cloud.sql
}

# --- Option D: Redis Cloud Prep ---
extract_redis_rdb() {
    echo "🔴 Extracting Redis RDB for Cloud Upload (AWS ElastiCache / Azure Redis)..."
    # Ensure Redis saves to disk first
    src_ssh "docker exec $REDIS_CONTAINER redis-cli SAVE"
    # Extract the dump.rdb
    src_ssh "docker cp $REDIS_CONTAINER:/data/dump.rdb /root/redis_dump.rdb"
    # Download locally
    scp -i "$SOURCE_KEY" -o StrictHostKeyChecking=no root@"$SOURCE_HOST":/root/redis_dump.rdb ./redis_dump.rdb
    src_ssh "rm /root/redis_dump.rdb"
    echo "✅ Success! File './redis_dump.rdb' is ready for upload to S3/Cloud storage."
    echo "👉 Tip: In AWS, upload this to S3 and use it to seed your ElastiCache instance."
}

migrate_volumes() {
    local vol_name=$1
    local backup_name=$2
    src_ssh "docker run --rm -v $vol_name:/data -v /root:/backup alpine tar czf /backup/$backup_name -C /data ."
    scp -i "$SOURCE_KEY" -o StrictHostKeyChecking=no root@"$SOURCE_HOST":/root/$backup_name ./$backup_name
    scp -i "$DEST_KEY" -o StrictHostKeyChecking=no ./$backup_name root@"$DEST_HOST":/root/$backup_name
    dest_ssh "docker run --rm -v $vol_name:/data -v /root:/backup alpine tar xzf /backup/$backup_name -C /data"
    src_ssh "rm /root/$backup_name"
    dest_ssh "rm /root/$backup_name"
    rm ./$backup_name
}

migrate_data() {
    migrate_postgres_docker
    migrate_volumes "$REDIS_VOL" "redis_migration.tar.gz"
    migrate_volumes "$AGENT_ZERO_VOL" "az_migration.tar.gz"
    migrate_volumes "$CREW_AI_VOL" "cai_migration.tar.gz"
    dest_ssh "docker restart $BACKEND_CONTAINER"
}

# --- Execution ---

case "$1" in
    deploy)
        deploy_code
        ;;
    migrate-data)
        migrate_data
        ;;
    migrate-cloud)
        migrate_postgres_cloud
        ;;
    docker-to-cloud)
        migrate_docker_to_cloud
        ;;
    extract-redis)
        extract_redis_rdb
        ;;
    full)
        deploy_code
        migrate_data
        ;;
    *)
        echo "Usage: $0 {deploy|migrate-data|migrate-cloud|docker-to-cloud|extract-redis|full}"
        exit 1
        ;;
esac
