#!/bin/bash
# ─── Startup Probe — Diagnose www.gpexts.com deployment issues ─────────────
# Run this on the server to check why the site is unreachable:
#   curl -sS https://raw.githubusercontent.com/.../scripts/startup-probe.sh | bash
#
# Or run directly:
#   bash scripts/startup-probe.sh
#
# Checks performed:
#   1. DNS resolution of www.gpexts.com and gpexts.com
#   2. Port connectivity (80, 443)
#   3. Docker container status
#   4. Docker Compose file presence
#   5. Traefik routing via HTTP requests
#   6. SSL certificate validity
#   7. Environment variables
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass()  { echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
info()  { echo -e "  ${CYAN}→${NC} $1"; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${NC}\n"; }

# Auto-detect compose directory: use COMPOSE_DIR env var, or derive from script location,
# or fall back to the known production path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-$PROJECT_DIR}"

# Auto-detect the ag-extension-dashboard compose directory
# Strategy: look for docker-compose.yml in the current or parent directories
if [ -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
    : # already set correctly
elif [ -f "${PROJECT_DIR}/ag-extension-dashboard/docker-compose.yml" ]; then
    COMPOSE_DIR="${PROJECT_DIR}/ag-extension-dashboard"
elif [ -f "${COMPOSE_DIR}/ag-extension-dashboard/docker-compose.yml" ]; then
    COMPOSE_DIR="${COMPOSE_DIR}/ag-extension-dashboard"
elif [ -f "${PROJECT_DIR}/ag_extension_decision_support/ag-extension-dashboard/docker-compose.yml" ]; then
    COMPOSE_DIR="${PROJECT_DIR}/ag_extension_decision_support/ag-extension-dashboard"
fi

# Fallback: extract compose directory from running Docker project
if [ "$COMPOSE_DIR" = "$PROJECT_DIR" ] && command -v docker &>/dev/null; then
    CONFIG_FILES=$(docker compose ls --format '{{.ConfigFiles}}' 2>/dev/null | grep -m1 -i ag 2>/dev/null)
    if [ -n "$CONFIG_FILES" ]; then
        COMPOSE_DIR=$(dirname "$(echo "$CONFIG_FILES" | cut -d: -f1)" 2>/dev/null)
    fi
fi
SERVER_IP="145.223.97.248"
DOMAIN="www.gpexts.com"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║     AG-Extension Deployment Diagnostics Probe          ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Running at: $(date)"
echo "  Server:     ${SERVER_IP}"
echo "  Domain:     ${DOMAIN}"
echo "  Compose:    ${COMPOSE_DIR}"
echo ""

# ─── 1. DNS Resolution ────────────────────────────────────────────────────
header "1. DNS Resolution"

for name in "${DOMAIN}" "gpexts.com"; do
    ips=$(dig +short "$name" 2>/dev/null | tr '\n' ' ')
    if [ -n "$ips" ]; then
        pass "${name} → ${ips}"
    else
        fail "${name} → DNS resolution FAILED"
        warn "  Check your DNS A record — it should point to ${SERVER_IP}"
    fi
done

# ─── 2. Port Connectivity ────────────────────────────────────────────────
header "2. Port Connectivity"

check_port() {
    local host="$1" port="$2" label="$3"
    if timeout 3 bash -c "echo >/dev/tcp/${host}/${port}" 2>/dev/null; then
        pass "Port ${port} (${label}) — OPEN"
        return 0
    else
        fail "Port ${port} (${label}) — CLOSED"
        return 1
    fi
}

check_port "localhost" 80 "HTTP (Traefik)"
check_port "localhost" 443 "HTTPS"
check_port "localhost" 3001 "Backend API"
check_port "localhost" 5432 "PostgreSQL"
check_port "localhost" 6379 "Redis"

echo ""
info "If port 443 is closed — docker-compose.prod.yml is not deployed."
info "Fix: docker compose -f ${COMPOSE_DIR}/docker-compose.yml -f ${COMPOSE_DIR}/docker-compose.prod.yml up -d"

# ─── 3. Docker Container Status ──────────────────────────────────────────
header "3. Docker Container Status"

CONTAINERS=("ag-extension-dashboard-traefik-1" "ag-dashboard-backend" "ag-dashboard-frontend" "ag-dashboard-db" "ag-dashboard-redis")

for container in "${CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"; then
        status=$(docker ps --filter "name=^${container}$" --format '{{.Status}}' 2>/dev/null)
        pass "${container} — ${status}"
    else
        fail "${container} — NOT RUNNING"
        warn "  Start with: docker compose -f ${COMPOSE_DIR}/docker-compose.yml up -d ${container}"
    fi
done

# ─── 4. Docker Compose File Check ────────────────────────────────────────
header "4. Docker Compose Configuration"

# Check which docker-compose files are being used for the running project
if docker compose ls 2>/dev/null | grep -q "ag-extension-dashboard"; then
    COMPOSE_FILES=$(docker compose ls --format '{{.ConfigFiles}}' 2>/dev/null | grep -i -E 'ag|extension' | head -1)
    if [ -n "$COMPOSE_FILES" ]; then
        info "Running compose files: ${COMPOSE_FILES}"
        if echo "$COMPOSE_FILES" | grep -q "prod"; then
            pass "docker-compose.prod.yml IS included in the deployment"
        else
            fail "docker-compose.prod.yml is NOT included"
            warn "  HTTPS and TLS will not work."
            warn "  Fix: docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.agents.yml up -d --build"
        fi
    else
        warn "Could not determine compose files in use"
    fi
else
    warn "No docker compose project found for 'ag-extension-dashboard'"
    if [ -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
        info "docker-compose.yml exists at ${COMPOSE_DIR}/docker-compose.yml"
    else
        fail "docker-compose.yml NOT found at ${COMPOSE_DIR}/docker-compose.yml"
    fi
    if [ -f "${COMPOSE_DIR}/docker-compose.prod.yml" ]; then
        pass "docker-compose.prod.yml exists"
    else
        fail "docker-compose.prod.yml NOT found at ${COMPOSE_DIR}/docker-compose.prod.yml"
    fi
fi

# ─── 5. Traefik Routing ──────────────────────────────────────────────────
header "5. Traefik Routing"

TRAEFIK_RESPONSE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:80/api/health 2>/dev/null)
if [ "$TRAEFIK_RESPONSE" = "200" ]; then
    pass "Backend reachable via Traefik on port 80 (HTTP ${TRAEFIK_RESPONSE})"
else
    fail "Backend NOT reachable via Traefik on port 80 (HTTP ${TRAEFIK_RESPONSE:-timeout})"
    warn "  Check Traefik labels in docker-compose.yml"
    info "  Try direct: curl http://localhost:3001/api/health"
    DIRECT_CHECK=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health 2>/dev/null)
    if [ "$DIRECT_CHECK" = "200" ]; then
        pass "Backend IS reachable directly on port 3001 (routing issue)"
    else
        fail "Backend not reachable directly either (backend may be unhealthy)"
    fi
fi

FRONTEND_RESPONSE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>/dev/null)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    pass "Frontend reachable via Traefik on port 80 (HTTP ${FRONTEND_RESPONSE})"
else
    fail "Frontend NOT reachable via Traefik on port 80 (HTTP ${FRONTEND_RESPONSE:-timeout})"
fi

# ─── 6. SSL Certificate ──────────────────────────────────────────────────
header "6. SSL Certificate"

SSL_INFO=$(echo | openssl s_client -servername "${DOMAIN}" -connect "${DOMAIN}":443 2>/dev/null | openssl x509 -noout -dates 2>&1)
if [ $? -eq 0 ] && [ -n "$SSL_INFO" ]; then
    pass "SSL certificate FOUND for ${DOMAIN}"
    echo "$SSL_INFO" | while read line; do echo "  ${CYAN}→${NC} $line"; done

    EXPIRY_DATE=$(echo "$SSL_INFO" | grep "notAfter" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    if [ "$DAYS_LEFT" -lt 30 ]; then
        warn "Certificate expires in ${DAYS_LEFT} days ($EXPIRY_DATE)"
    else
        pass "Certificate valid for ${DAYS_LEFT} more days"
    fi
else
    fail "SSL certificate check FAILED for ${DOMAIN}:443"
    warn "  Either HTTPS is not running, or Let's Encrypt hasn't provisioned a cert yet."
    warn "  This is expected if docker-compose.prod.yml is not deployed."
fi

# ─── 7. Environment Variables ───────────────────────────────────────────
header "7. Environment Variables"

if [ -f "${COMPOSE_DIR}/.env" ]; then
    pass ".env file exists at ${COMPOSE_DIR}/.env"
    if grep -q "ACME_EMAIL" "${COMPOSE_DIR}/.env" 2>/dev/null; then
        pass "ACME_EMAIL is set (required for Let's Encrypt)"
    else
        fail "ACME_EMAIL is NOT set in .env"
        warn "  Add: ACME_EMAIL=admin@gpexts.com"
    fi
else
    fail ".env file NOT found at ${COMPOSE_DIR}/.env"
    warn "  Create it with: echo 'ACME_EMAIL=admin@gpexts.com' > ${COMPOSE_DIR}/.env"
fi

# ─── Summary ─────────────────────────────────────────────────────────────
header "Summary"

echo ""
if timeout 3 bash -c "echo >/dev/tcp/localhost/443" 2>/dev/null; then
    echo -e "  ${GREEN}${BOLD}✓ HTTPS (443) is OPEN${NC} — site should be accessible at https://${DOMAIN}/"
else
    if timeout 3 bash -c "echo >/dev/tcp/localhost/80" 2>/dev/null; then
        echo -e "  ${YELLOW}${BOLD}⚠ HTTP (80) is OPEN but HTTPS (443) is CLOSED${NC}"
        echo -e "  ${YELLOW}${BOLD}  The site is reachable on HTTP only.${NC}"
        echo ""
        echo -e "  ${BOLD}Recommended fix:${NC}"
        echo "    cd ${COMPOSE_DIR}"
        echo "    docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.agents.yml up -d --build"
    else
        echo -e "  ${RED}${BOLD}✗ BOTH HTTP (80) and HTTPS (443) are CLOSED${NC}"
        echo -e "  ${RED}${BOLD}  Traefik may not be running.${NC}"
        echo ""
        echo -e "  ${BOLD}Recommended fix:${NC}"
        echo "    docker ps | grep traefik"
        echo "    cd ${COMPOSE_DIR}"
        echo "    docker compose -f docker-compose.yml up -d traefik"
    fi
fi

echo ""
echo -e "  ${CYAN}→${NC} For detailed diagnostics via API (authenticated):"
echo -e "  ${CYAN}→${NC}   curl http://localhost:3001/api/health/diagnostics"
echo ""
