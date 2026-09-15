#!/usr/bin/env bash
# Deploy the stage environment on the remote production server while preserving
# DB and Redis volumes.
#
# Security/config requirements:
#   - SSH key path comes from DEPLOY_SSH_KEY (never hardcoded user paths).
#   - Remote target host/user come from DEPLOY_STAGE_HOST / DEPLOY_STAGE_USER.
#   - host key checking stays ON (known_hosts must contain the host); use
#     DEPLOY_KNOWN_HOSTS_FILE if the key lives outside ~/.ssh/known_hosts.
#   - Post-deploy health gates run on the remote; a failed gate exits non-zero
#     so callers/CI never mistake a broken deploy for success.
set -euo pipefail

: "${DEPLOY_SSH_KEY:?Set DEPLOY_SSH_KEY to the path of the deploy SSH private key}"
: "${DEPLOY_STAGE_HOST:?Set DEPLOY_STAGE_HOST to the target server host}"
DEPLOY_STAGE_USER="${DEPLOY_STAGE_USER:-root}"
DEPLOY_KNOWN_HOSTS_FILE="${DEPLOY_KNOWN_HOSTS_FILE:-$HOME/.ssh/known_hosts}"
SSH_OPTS=(-i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$DEPLOY_KNOWN_HOSTS_FILE" -o PasswordAuthentication=no)

ssh "${SSH_OPTS[@]}" "${DEPLOY_STAGE_USER}@${DEPLOY_STAGE_HOST}" <<'EOS'
  set -e
  cd /root/ag_extension_decision_support/ag-extension-dashboard
  git fetch origin
  git checkout -f stage
  # Fast-forward only: never clobber host-side state blindly.
  git merge --ff-only origin/stage
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-recreate app-db redis
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

  # ── Post-deploy health gate (Node fetch: slim images may lack wget/curl) ──
  sleep 15
  HEALTH_OK=0
  if docker exec ag-dashboard-backend \
      node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "  ✅ Backend healthy"
  else
    echo "  ❌ Backend unhealthy"; HEALTH_OK=1
  fi
  if docker exec ag-dashboard-frontend \
      node -e "fetch('http://localhost:80/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "  ✅ Frontend healthy"
  else
    echo "  ❌ Frontend unhealthy"; HEALTH_OK=1
  fi
  exit "$HEALTH_OK"
EOS
