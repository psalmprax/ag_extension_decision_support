#!/bin/bash

# ==============================================================================
# AG-Extension Automated Database Backup
# ==============================================================================
# This script performs a Postgres dump and stores it in a timestamped file.
# It also includes logic to prune old backups.
# ==============================================================================

# Configuration
BACKUP_DIR="/root/backups/postgres"
RETENTION_DAYS=7
DB_NAME="ag_extension"
DB_CONTAINER="ag-dashboard-db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="ag_extension_$TIMESTAMP.sql"

echo "🐘 Starting Automated Backup at $(date)"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

# 1. Perform the dump
docker exec $DB_CONTAINER pg_dumpall -U postgres > $BACKUP_DIR/$FILENAME

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $FILENAME"
    
    # 2. Compress the backup
    gzip $BACKUP_DIR/$FILENAME
    echo "📦 Compressed: $FILENAME.gz"
    
    # 3. Prune old backups
    echo "🧹 Pruning backups older than $RETENTION_DAYS days..."
    find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;
    echo "✨ Cleanup finished."
else
    echo "❌ Backup failed!"
    exit 1
fi

echo "🏁 Backup Process Finished Successfully."
