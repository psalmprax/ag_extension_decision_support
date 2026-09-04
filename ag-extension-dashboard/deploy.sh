#!/usr/bin/env bash
# ============================================================
# AG-Extension Dashboard — Deploy Script
# ============================================================
# Usage:
#   ./deploy.sh dev           — local development (hot reload)
#   ./deploy.sh staging       — staging environment
#   ./deploy.sh prod          — production (HTTPS + Let's Encrypt)
#   ./deploy.sh prod --build  — production with image rebuild
#   ./deploy.sh down          — stop all services
#   ./deploy.sh logs [svc]    — tail logs (all or specific service)
#   ./deploy.sh status        — show container status
#   ./deploy.sh restart <svc> — restart a service
#   ./deploy.sh ps            — list running containers
#
# Environments:
#   dev     → docker-compose.yml + docker-compose.dev.yml
#   staging → docker-compose.yml + docker-compose.staging.yml (future)
#   prod    → docker-compose.yml + docker-compose.prod.yml
# ============================================================

set -euo pipefail

# ── Colour output ──────────────────────────────────────────
RED='\u001b[31;1m'
GRN='\u001b[32;1m'
YEL='\u001b[33;1m'
BLU='\u001b[34;1m'
CYA='\u001b[36;1m'
RST='\u001b[0m'

info()    { echo -e "${BLU}[INFO]${RST}  $*"; }
success() { echo -e "${GRN}[OK]${RST}   $*"; }
warn()    { echo -e "${YEL}[WARN]${RST}  $*"; }
error()   { echo -e "${RED}[ERR]${RST}   $*" >&2; exit 1; }

# ── Paths ──────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="-f docker-compose.yml"
DEV_OVERLAY="-f docker-compose.dev.yml"
STAGING_OVERLAY="-f docker-compose.staging.yml"
PROD_OVERLAY="-f docker-compose.prod.yml"
AGENTS_OVERLAY="-f docker-compose.agents.yml"

# ── Helpers ────────────────────────────────────────────────
run_compose() {
  docker compose $COMPOSE_FILE "$@" 2>&1
}

need_env() {
  if [[ ! -f .env ]]; then
    error ".env file not found. Copy .env.example to .env and fill in values."
  fi
}

check_env_var() {
  local var="$1"
  local val="$(eval echo "\/${var}")"
  if [[ -z "${val:-}" ]]; then
    warn "Environment variable $var is not set or empty"
    return 1
  fi
  return 0
}

check_env_file() {
  local var="$1"
  if ! grep -q "^${var}=" .env 2>/dev/null; then
    warn "Variable $var is missing from .env"
    return 1
  fi
  return 0
}

# ── Commands ───────────────────────────────────────────────
cmd_dev() {
  need_env
  info "Starting development stack (hot reload enabled)..."
  run_compose $DEV_OVERLAY up -d
  success "Dev stack started. Browse to http://localhost:7503"
  info "Services:"
  run_compose $DEV_OVERLAY ps --format "  ${CYA}%s${RST}  %-20s %s" | sed 's/^/  /'
}

cmd_staging() {
  if [[ ! -f docker-compose.staging.yml ]]; then
    error "docker-compose.staging.yml not found. Create it first."
  fi
  need_env
  check_env_file STAGING_DOMAIN || true
  info "Starting staging stack..."
  run_compose $STAGING_OVERLAY up -d
  success "Staging stack started."
}

cmd_prod() {
  need_env
  check_env_file ACME_EMAIL
  check_env_file DOMAIN
  info "Starting production stack (HTTPS + Let's Encrypt)..."
  run_compose $PROD_OVERLAY up -d --build "$@"
  success "Production stack started."
  info "HTTPS is active — browse to https://${DOMAIN:-www.gpexts.com}"
}

cmd_down() {
  info "Stopping all services..."
  run_compose $DEV_OVERLAY $PROD_OVERLAY down 2>/dev/null || true
  docker rm -f ag-discovery-scraper ag-agent-zero ag-crew-ai 2>/dev/null || true
  success "All services stopped."
}

cmd_logs() {
  local svc="${1:-}"
  if [[ -n "$svc" ]]; then
    run_compose logs -f --tail=100 "$svc"
  else
    run_compose logs -f --tail=50
  fi
}

cmd_status() {
  run_compose ps
}

cmd_restart() {
  local svc="${1:-}"
  [[ -z "$svc" ]] && error "Usage: deploy.sh restart <service-name>"
  info "Restarting $svc..."
  run_compose restart "$svc"
  success "$svc restarted."
}

cmd_ps() {
  run_compose ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

cmd_env_check() {
  info "Checking required .env variables..."
  local missing=0
  for var in DATABASE_USER DATABASE_PASSWORD DATABASE_NAME DOMAIN JWT_SECRET; do
    if ! check_env_file "$var"; then
      missing=$((missing + 1))
    fi
  done
  if [[ $missing -eq 0 ]]; then
    success "All required .env variables are present."
  else
    warn "$missing required variable(s) missing from .env"
  fi
}

# ── Main ────────────────────────────────────────────────────
ACTION="${1:-}"
shift || true

case "$ACTION" in
  dev|development)
    cmd_dev "$@"
    ;;
  staging|stg)
    cmd_staging "$@"
    ;;
  prod|production)
    cmd_prod "$@"
    ;;
  down|stop)
    cmd_down
    ;;
  logs)
    cmd_logs "$@"
    ;;
  status)
    cmd_status
    ;;
  restart)
    cmd_restart "$@"
    ;;
  ps)
    cmd_ps
    ;;
  check|env-check)
    cmd_env_check
    ;;
  help|--help|-h)
    echo "Usage: deploy.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  dev              Start development stack (hot reload)"
    echo "  staging          Start staging stack"
    echo "  prod [--build]   Start production stack (HTTPS + Let's Encrypt)"
    echo "  down             Stop all services"
    echo "  logs [service]   Tail logs (all or specific service)"
    echo "  status           Show container status"
    echo "  ps               List running containers"
    echo "  restart <svc>    Restart a specific service"
    echo "  check            Verify required .env variables"
    echo ""
    echo "Environment files:"
    echo "  dev     → docker-compose.yml + docker-compose.dev.yml"
    echo "  staging → docker-compose.yml + docker-compose.staging.yml"
    echo "  prod    → docker-compose.yml + docker-compose.prod.yml"
    echo ""
    echo "Add agents to any stack:"
    echo "  dev:     docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.agents.yml up -d"
    echo "  prod:    ./deploy.sh prod && docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.agents.yml up -d"
    ;;
  "")
    error "Usage: deploy.sh <dev|staging|prod|down|logs|status|restart|check|help>"
    ;;
  *)
    error "Unknown command: $ACTION. Run deploy.sh help for usage."
    ;;
esac