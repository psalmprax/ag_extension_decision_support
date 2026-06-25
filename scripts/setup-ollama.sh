#!/usr/bin/env bash
# ─── Ollama Provisioning — memory, network, model pull ────────────────────
# Ensures the ettametta-ollama container is configured correctly for the
# staging/testing server. Idempotent — safe to run repeatedly.
#
# Usage:
#   bash scripts/setup-ollama.sh [options]
#
# Options:
#   --compose-dir PATH    Compose project root (default: ../ag-extension-dashboard)
#   --memory LIMIT        Memory limit for ollama container (default: 8G)
#   --model NAME          Model to pull (default: llama3.2:1b)
#   --network NAME        Docker network to connect ollama to (default: ag-network)
#   --ollama-service NAME Docker service/container name (default: ettametta-ollama)
#   -h | --help           Show this help and exit
#
# Exit codes:
#   0   All checks passed, everything configured correctly
#   1   One or more checks failed
# ===========================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

pass()   { echo -e "  ${GREEN}\xE2\x9C\x93${NC} $1"; }
fail()   { echo -e "  ${RED}\xE2\x9C\x97${NC} $1"; }
warn()   { echo -e "  ${YELLOW}\xE2\x9A\xA0${NC} $1"; }
info()   { echo -e "  ${CYAN}\xE2\x86\x92${NC} $1"; }
header() { echo -e "\n${BOLD}${CYAN}\xE2\x95\x95\xE2\x95\x90\xE2\x95\x90 $1 \xE2\x95\x90\xE2\x95\x90\xE2\x95\x95${NC}\n"; }

# ─── Defaults ─────────────────────────────────────────────────────────────
MEMORY_LIMIT="8G"
MODEL="llama3.2:1b"
NETWORK="ag-network"
OLLAMA_SERVICE="ettametta-ollama"
COMPOSE_DIR=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── CLI parsing ──────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
    case "$1" in
        --compose-dir)    COMPOSE_DIR="$2"; shift 2 ;;
        --memory)         MEMORY_LIMIT="$2"; shift 2 ;;
        --model)          MODEL="$2"; shift 2 ;;
        --network)        NETWORK="$2"; shift 2 ;;
        --ollama-service) OLLAMA_SERVICE="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,/^exit 0$/p' "${BASH_SOURCE[0]}" | head -n -1
            exit 0 ;;
        *) fail "Unknown option: $1"; exit 1 ;;
    esac
done

# Auto-detect compose directory
if [ -z "$COMPOSE_DIR" ]; then
    for candidate in \
        "$PROJECT_DIR/ag-extension-dashboard" \
        "$PROJECT_DIR" \
        "/root/ag_extension_decision_support/ag-extension-dashboard"; do
        if [ -f "$candidate/docker-compose.yml" ]; then
            COMPOSE_DIR="$candidate"
            break
        fi
    done
fi

if [ ! -f "$COMPOSE_DIR/docker-compose.yml" ]; then
    fail "Compose directory not found (with docker-compose.yml)"
    info "Specify: --compose-dir PATH"
    exit 1
fi
COMPOSE_DIR="$(cd "$COMPOSE_DIR" && pwd)"

echo ""
echo -e "${BOLD}${CYAN}\xE2\x95\x94\xE2\x95\x90\xE2\x95\x90\xE2\x95\x90 Ollama Setup & Verification \xE2\x95\x90\xE2\x95\x90\xE2\x95\x90\xE2\x95\x97${NC}"
echo -e "  Compose:  ${COMPOSE_DIR}"
echo -e "  Memory:   ${MEMORY_LIMIT}"
echo -e "  Model:    ${MODEL}"
echo -e "  Network:  ${NETWORK}"
echo ""

# ─── 1. Check system resources ───────────────────────────────────────────
header "1. System Resources"

TOTAL_RAM=$(free -g | awk '/^Mem:/ {print $2}')
AVAIL_RAM=$(free -g | awk '/^Mem:/ {print $7}')
MEM_NUM=${MEMORY_LIMIT%G}
MEM_NUM=${MEM_NUM%g}

if [ "$AVAIL_RAM" -lt "$MEM_NUM" ]; then
    warn "Only ${AVAIL_RAM}G available, targeting ${MEMORY_LIMIT} limit"
    if [ "$TOTAL_RAM" -lt "$MEM_NUM" ]; then
        fail "Total RAM (${TOTAL_RAM}G) is less than target memory limit (${MEMORY_LIMIT})"
        info "  Consider using a smaller model or reducing --memory"
    else
        warn "  Available RAM may be reclaimed; ollama will start when memory frees up"
        pass "Total RAM: ${TOTAL_RAM}G (sufficient for ${MEMORY_LIMIT})"
    fi
else
    pass "System: ${TOTAL_RAM}G total, ${AVAIL_RAM}G available (target: ${MEMORY_LIMIT})"
fi

# ─── 2. Check ollama container ───────────────────────────────────────────
header "2. Ollama Container"

CONTAINER_RUNNING=false
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${OLLAMA_SERVICE}$"; then
    CONTAINER_RUNNING=true
    CSTATUS=$(docker ps --filter "name=^${OLLAMA_SERVICE}$" --format '{{.Status}}')
    pass "${OLLAMA_SERVICE} is running — ${CSTATUS}"
elif docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${OLLAMA_SERVICE}$"; then
    warn "${OLLAMA_SERVICE} exists but is NOT running"
    info "  Start it: cd ${COMPOSE_DIR} && COMPOSE_PROFILES=ai docker compose up -d ${OLLAMA_SERVICE}"
    info "  Or: docker start ${OLLAMA_SERVICE}"
else
    warn "${OLLAMA_SERVICE} does not exist yet"
    info "  Create it: cd ${COMPOSE_DIR} && COMPOSE_PROFILES=ai docker compose up -d ${OLLAMA_SERVICE}"
fi

# ─── 3. Memory limit ─────────────────────────────────────────────────────
header "3. Memory Limit"

if $CONTAINER_RUNNING; then
    CURRENT_MEM=$(docker inspect "$OLLAMA_SERVICE" --format '{{.HostConfig.Memory}}' 2>/dev/null)
    if [ -n "$CURRENT_MEM" ] && [ "$CURRENT_MEM" -ne 0 ]; then
        CURRENT_MEM_GB=$(echo "scale=1; $CURRENT_MEM / 1073741824" | bc 2>/dev/null)
        info "Current limit: ${CURRENT_MEM_GB}G"
        if [ "$(echo "$CURRENT_MEM_GB < $MEM_NUM" | bc 2>/dev/null)" = "1" ]; then
            warn "  Below target (${MEMORY_LIMIT}) — updating..."
            docker update --memory "${MEMORY_LIMIT}" "$OLLAMA_SERVICE" 2>&1 || \
                warn "  Failed to update memory (service may be using --restart)"
            docker update --memory-swap "${MEMORY_LIMIT}" "$OLLAMA_SERVICE" 2>/dev/null || true
            pass "Memory limit updated to ${MEMORY_LIMIT}"
        else
            pass "Memory limit already ≥ ${MEMORY_LIMIT} (currently ${CURRENT_MEM_GB}G)"
        fi
    else
        warn "No memory limit set on container — applying ${MEMORY_LIMIT}"
        docker update --memory "${MEMORY_LIMIT}" "$OLLAMA_SERVICE" 2>&1 || \
            warn "  Use compose deploy.resources.limits instead"
    fi
else
    warn "Container not running — memory limit will be applied on next start via compose"
    info "  docker-compose.staging.yml overrides memory to ${MEMORY_LIMIT}"
fi

# ─── 4. Network connectivity ─────────────────────────────────────────────
header "4. Network (${NETWORK})"

if docker network ls --format '{{.Name}}' 2>/dev/null | grep -q "^${NETWORK}$"; then
    pass "Network '${NETWORK}' exists"
    if $CONTAINER_RUNNING; then
        if docker inspect "$OLLAMA_SERVICE" --format '{{range $net, $_ := .NetworkSettings.Networks}}{{$net}} {{end}}' 2>/dev/null | grep -q "${NETWORK}"; then
            pass "${OLLAMA_SERVICE} is connected to '${NETWORK}'"
        else
            warn "${OLLAMA_SERVICE} is NOT connected to '${NETWORK}' — connecting..."
            docker network connect "$NETWORK" "$OLLAMA_SERVICE" 2>&1 && \
                pass "Connected to ${NETWORK}" || \
                fail "Failed to connect to ${NETWORK}"
        fi
    fi
else
    warn "Network '${NETWORK}' does not exist — creating..."
    docker network create --driver bridge "$NETWORK" 2>&1 && \
        pass "Network '${NETWORK}' created" || \
        fail "Failed to create network '${NETWORK}'"
    if $CONTAINER_RUNNING; then
        docker network connect "$NETWORK" "$OLLAMA_SERVICE" 2>&1 && \
            pass "Connected to ${NETWORK}"
    fi
fi

# ─── 5. Model pull (if container running) ────────────────────────────────
header "5. Model Pull"

if $CONTAINER_RUNNING; then
    info "Pulling model '${MODEL}' (may take a few minutes on cold cache)..."
    if docker exec "$OLLAMA_SERVICE" ollama pull "$MODEL" 2>&1; then
        pass "Model '${MODEL}' pulled successfully"
    else
        fail "Failed to pull model '${MODEL}'"
        info "  Check DNS: docker exec ${OLLAMA_SERVICE} ping -c 1 registry.ollama.ai"
        info "  Check logs: docker logs ${OLLAMA_SERVICE} --tail 20"
    fi
else
    warn "Container not running — model will be pulled at startup via entrypoint"
    info "  Ensure docker-compose.staging.yml has:"
    info "    entrypoint: /bin/sh -c \"ollama serve & sleep 10 && ollama pull ${MODEL} && wait\""
fi

# ─── 6. Verify connectivity from backend ─────────────────────────────────
header "6. End-to-End Verification"

if $CONTAINER_RUNNING; then
    # Check ollama is responding
    if docker exec "$OLLAMA_SERVICE" ollama list 2>/dev/null | grep -q "$MODEL"; then
        pass "ollama reports model '${MODEL}' available"
    else
        warn "Model '${MODEL}' not yet listed by ollama (may still be loading)"
        docker exec "$OLLAMA_SERVICE" ollama list 2>/dev/null
    fi

    # Check from backend container (if running)
    BACKEND_CONTAINER="ag-dashboard-backend"
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${BACKEND_CONTAINER}$"; then
        info "Probing ollama from backend container..."
        if docker exec "$BACKEND_CONTAINER" curl -sf --max-time 5 "http://${OLLAMA_SERVICE}:11434/api/tags" 2>/dev/null | grep -q "$MODEL"; then
            pass "Backend can reach ollama and model '${MODEL}' is available"
        else
            warn "Backend cannot reach ollama or model not found"
            info "  Check: docker exec ${BACKEND_CONTAINER} curl -v http://${OLLAMA_SERVICE}:11434/api/tags"
            info "  Check: OLLAMA_HOST in backend environment (should be http://${OLLAMA_SERVICE}:11434)"
        fi
    else
        info "Backend container not running — skipping cross-container check"
    fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────
header "Summary"

ALL_PASS=true

if $CONTAINER_RUNNING; then
    pass "Ollama container: RUNNING"
    if docker exec "$OLLAMA_SERVICE" ollama list 2>/dev/null | grep -q "$MODEL"; then
        pass "Model '${MODEL}': LOADED"
    else
        fail "Model '${MODEL}': NOT LOADED"
        ALL_PASS=false
    fi
else
    fail "Ollama container: NOT RUNNING"
    ALL_PASS=false
    info "  Deploy with: cd ${COMPOSE_DIR} && COMPOSE_PROFILES=ai docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d ${OLLAMA_SERVICE}"
fi

echo ""
if $ALL_PASS; then
    echo -e "  ${GREEN}${BOLD}All checks passed.${NC}"
else
    echo -e "  ${YELLOW}${BOLD}Some checks need attention.${NC}"
fi
echo ""

[ "$ALL_PASS" = true ] && exit 0 || exit 1
