#!/usr/bin/env bash
set -e
# Deploy the stage environment on the remote production server while preserving DB and Redis volumes
ssh -i /home/psalmprax/Videos/id_key -o StrictHostKeyChecking=no -o PasswordAuthentication=no root@145.223.97.248 <<'EOS'
  cd /root/ag_extension_decision_support/ag-extension-dashboard
  git fetch origin
  git reset --hard origin/stage
  git checkout -f stage
  git pull origin stage
  # Preserve existing app-db and redis containers/volumes
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-recreate app-db redis
  # Build and (re)create other services
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
EOS
