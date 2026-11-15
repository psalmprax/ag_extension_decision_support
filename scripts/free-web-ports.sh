#!/usr/bin/env bash
# Free host ports 80/443 for this project's Traefik — without touching anything
# that is not ours.
#
# Replaces the deploy workflow's old approach (remove EVERY container publishing
# 80/443, then `fuser -k` / `pkill -9` whatever still listened), which on a
# shared host could take down another project's containers or processes.
#
#   1. remove this project's own containers that publish 80/443
#      (compose project label, plus the fixed `ag-traefik` name);
#   2. stop/disable host apache2 and nginx (unchanged from before);
#   3. if something still listens:
#        - a container from another project publishes the port -> fail, list it;
#        - only docker-proxy holds it and NO running container publishes the
#          port -> the proxy is an orphan (a known Docker failure mode): kill it;
#        - anything else -> fail and show the holder. Never kill unknown processes.
#
# Usage (from the compose directory): free-web-ports.sh [project-name]
# The project name defaults to $COMPOSE_PROJECT_NAME, then the directory name.
set -uo pipefail

PROJECT="${1:-${COMPOSE_PROJECT_NAME:-$(basename "$PWD")}}"
PORTS="80 443"
SS_FILTER='( sport = :80 or sport = :443 )'

listeners() { ss -Htlnp "$SS_FILTER" 2>/dev/null; }
publishers() {
  # Running containers publishing 80/443, as "name (project label)" lines.
  local p
  for p in $PORTS; do
    docker ps --filter "publish=$p" \
      --format '{{.Names}} (project: {{.Label "com.docker.compose.project"}})' 2>/dev/null
  done | sort -u
}

echo "Freeing ports 80/443 for project '$PROJECT'..."

docker rm -f ag-traefik >/dev/null 2>&1 || true
for p in $PORTS; do
  for cid in $(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT" --filter "publish=$p" 2>/dev/null); do
    docker rm -f "$cid" >/dev/null
  done
done

for svc in apache2 nginx; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    echo "  stopping host $svc"
    systemctl stop "$svc"
    systemctl disable "$svc" >/dev/null 2>&1 || true
  fi
done

held="$(listeners)"
if [ -z "$held" ]; then
  echo "  ports 80/443 are free"
  exit 0
fi

foreign="$(publishers)"
if [ -n "$foreign" ]; then
  echo "FATAL: ports 80/443 are published by containers that do not belong to '$PROJECT':" >&2
  echo "$foreign" | sed 's/^/  /' >&2
  echo "Stop them deliberately (they may be serving another site), then re-run the deploy." >&2
  exit 1
fi

holders="$(echo "$held" | grep -o 'users:(("[^"]*"' | sed 's/users:(("//; s/"$//' | sort -u)"
if [ "$holders" = "docker-proxy" ]; then
  echo "  orphaned docker-proxy on 80/443 (no container publishes it) — terminating"
  pkill -f 'docker-proxy.*-host-port (80|443)( |$)' || true
  for _ in 1 2 3 4 5; do
    [ -z "$(listeners)" ] && { echo "  ports 80/443 are free"; exit 0; }
    sleep 1
  done
  pkill -9 -f 'docker-proxy.*-host-port (80|443)( |$)' || true
  sleep 1
  [ -z "$(listeners)" ] && { echo "  ports 80/443 are free"; exit 0; }
fi

echo "FATAL: ports 80/443 are still held by a process this deploy does not own:" >&2
listeners | sed 's/^/  /' >&2
echo "Identify and stop it deliberately, then re-run the deploy." >&2
exit 1
