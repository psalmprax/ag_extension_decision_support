#!/usr/bin/env bash
# ============================================================
# Docker Disk Usage Health Check
# ============================================================
# Usage:
#   Direct:        ./check-docker-disk.sh
#   Over SSH:      ssh root@server 'bash -s' < check-docker-disk.sh
#   With prune:    ./check-docker-disk.sh --prune
#   Alert only:    ./check-docker-disk.sh --alert-threshold 80
# ============================================================

set -euo pipefail

RED='\033[0;31m'
YEL='\033[1;33m'
GRN='\033[0;32m'
CYA='\033[0;36m'
RST='\033[0m'

ALERT_THRESHOLD=80   # alert if disk usage % exceeds this
DO_PRUNE=false

for arg in "$@"; do
  case "$arg" in
    --prune)       DO_PRUNE=true ;;
    --alert-threshold=*) ALERT_THRESHOLD="${arg#*=}" ;;
    --help|-h)
      echo "Usage: check-docker-disk.sh [--prune] [--alert-threshold=80]"
      echo "  --prune               Also prune unused images/containers/volumes"
      echo "  --alert-threshold=X   Alert if disk usage exceeds X% (default: 80)"
      exit 0
      ;;
  esac
done

echo "========================================"
echo "  Docker Disk Usage Report"
  echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# ── 1. Filesystem disk usage ──────────────────────────────
echo ""
echo -e "${CYA}📁 Filesystem disk usage:${RST}"
DF_OUTPUT=$(df -h / 2>/dev/null | tail -1)
USED_PCT=$(echo "$DF_OUTPUT" | awk '{print $5}' | tr -d '%')
echo "  $(df -h / | tail -1 | awk '{print "Total: " $2 "  Used: " $3 "  Avail: " $4 "  Use%: " $5}')"

if [ "$USED_PCT" -ge "$ALERT_THRESHOLD" ]; then
  echo -e "  ${RED}⚠️  WARNING: Disk usage ${USED_PCT}% exceeds threshold ${ALERT_THRESHOLD}%${RST}"
else
  echo -e "  ${GRN}✅ Disk usage ${USED_PCT}% is below threshold ${ALERT_THRESHOLD}%${RST}"
fi

# ── 2. Docker system summary ──────────────────────────────
echo ""
echo -e "${CYA}🐳 Docker system df:${RST}"
docker system df 2>/dev/null || echo "  (Docker not available or permission denied)"

# ── 3. Docker disk usage breakdown ────────────────────────
echo ""
echo -e "${CYA}📊 Docker disk usage breakdown:${RST}"
echo "  Images:   $(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | wc -l) total"
echo "  Containers: $(docker ps -a -q 2>/dev/null | wc -l) total ($(docker ps -q 2>/dev/null | wc -l) running)"
echo "  Volumes:  $(docker volume ls -q 2>/dev/null | wc -l) total"
echo "  Networks: $(docker network ls -q 2>/dev/null | wc -l) total"

# ── 4. Largest images (top 10) ────────────────────────────
echo ""
echo -e "${CYA}🏋️  Largest images (top 10):${RST}"
docker images --format '{{.Size}}\t{{.Repository}}:{{.Tag}}' 2>/dev/null \
  | sort -rh | head -10 | awk '{printf "  %-20s %s\n", $1, $2}'

# ── 5. Unused/dangling images ─────────────────────────────
echo ""
echo -e "${CYA}🗑️  Unused/dangling images:${RST}"
DANGLING=$(docker images -f "dangling=true" -q 2>/dev/null | wc -l)
echo "  Dangling: $DANGLING"
UNUSED=$(docker image ls -f "dangling=false" --format '{{.ID}}' 2>/dev/null | while read id; do
  docker ps -a --filter "ancestor=$id" -q 2>/dev/null || true
done | wc -l)
echo "  Unused containers referencing old images: check 'docker ps -a'"

# ── 6. Optional: Prune ────────────────────────────────────
if [ "$DO_PRUNE" = true ]; then
  echo ""
  echo -e "${YEL}🧹 Running cleanup...${RST}"
  echo "  Pruning unused images..."
  docker image prune -a -f --filter "until=24h" 2>/dev/null || true
  echo "  Pruning stopped containers..."
  docker container prune -f --filter "until=24h" 2>/dev/null || true
  echo "  Pruning unused volumes..."
  docker volume prune -f 2>/dev/null || true
  echo "  Pruning build cache..."
  docker builder prune -f --filter "until=24h" 2>/dev/null || true
  echo ""
  echo -e "${GRN}📊 Disk usage after cleanup:${RST}"
  docker system df 2>/dev/null
fi

echo ""
echo "========================================"
echo "  Health check complete"
echo "========================================"
