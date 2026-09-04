#!/usr/bin/env bash
# ─── Smoke Test — Verify ettametta-ollama is live before pushing ─────────
# Runs `curl -sf http://ettametta-ollama:11434/api/tags` from inside the
# backend container (via `docker compose exec backend …`) so CI deploy-stage
# can gate production pushes on the AI fallback actually being reachable.
#
# Usage:
#   scripts/smoke-ollama.sh [options]
#
# Options:
#   --app-dir PATH       Compose project root (default: ../ag-extension-dashboard
#                        relative to repo root, override with COMPOSE_DIR env)
#   --service NAME       Container service to exec into (default: backend)
#   --ollama-url URL     Ollama HTTP URL probed inside the container
#                        (default: http://ettametta-ollama:11434/api/tags)
#   --retries N          Attempts before giving up (default: 30)
#   --interval S         Seconds between attempts (default: 10)
#   --if-running         Pass with a warning when ettametta-ollama isn't running.
#                        Use on first deploys where the `ai` profile isn't active
#                        yet (e.g. when minimal host staging hasn't brought up
#                        the model container).
#   --expected-model NAME  Model name expected in /api/tags response
#                        (default: llama3.2:3b, matches compose entrypoint
#                        pull). Falling-back to a generic 'models[] non-empty'
#                        check is not enough: a freshly-restarted ollama whose
#                        cold-pull was DNS-blocked will return [] only briefly,
#                        or [] → [other-model-only] once one of the bundled
#                        models completes. Requiring the *expected* model name
#                        surfaces the semantic-regression case at gate time.
#   -h | --help          Show this help and exit
#
# Exit codes:
#   0   PASS (probed OK with `models` array populated, OR --if-running + absent)
#   1   FAIL after all retries (timeout, non-JSON, empty models array)
#   2   misconfiguration (bad option, missing compose dir, service not running)
# ===========================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass()    { echo -e "  ${GREEN}\xE2\x9C\x93${NC} $1"; }
fail()    { echo -e "  ${RED}\xE2\x9C\x97${NC} $1"; }
warn()    { echo -e "  ${YELLOW}\xE2\x9A\xA0${NC} $1"; }
info()    { echo -e "  ${CYAN}\xE2\x86\x92${NC} $1"; }
header()  { echo -e "\n${BOLD}${CYAN}\xE2\x95\x95\xE2\x95\x90\xE2\x95\x90 $1 \xE2\x95\x90\xE2\x95\x90\xE2\x95\x95${NC}\n"; }

# ─── Defaults ─────────────────────────────────────────────────────────────
SERVICE="backend"
OLLAMA_URL="http://ettametta-ollama:11434/api/tags"
OLLA_SERVICE="ettametta-ollama"
RETRIES=30
INTERVAL=10
IF_RUNNING=0
EXPECTED_MODEL="${EXPECTED_MODEL:-llama3.2:3b}"
COMPOSE_DIR_OVERRIDE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-$PROJECT_DIR/ag-extension-dashboard}"

# ─── CLI parsing ──────────────────────────────────────────────────────────
print_help() {
    cat <<'HELP'
Usage: scripts/smoke-ollama.sh [options]

  --app-dir PATH       Compose project root (default: ../ag-extension-dashboard)
  --service NAME       Container service to exec into (default: backend)
  --ollama-url URL     Ollama HTTP URL probed inside the container
                       (default: http://ettametta-ollama:11434/api/tags)
  --retries N          Attempts before giving up (default: 30)
  --interval S         Seconds between attempts (default: 10)
  --if-running         Pass with a warning when ettametta-ollama isn't running.
                       Use on first deploys where the `ai` profile isn't active
                       yet.
  --expected-model NAME  Model name expected in /api/tags response
                       (default: llama3.2:3b)
  -h | --help          Show this help and exit

Exit codes:
  0  PASS (probed OK with `models` array populated, OR --if-running + absent)
  1  FAIL after all retries
  2  misconfiguration (bad option, missing compose dir, service not running)
HELP
    exit 0
}

while [ $# -gt 0 ]; do
    case "$1" in
        --app-dir)    COMPOSE_DIR_OVERRIDE="$2"; shift 2 ;;
        --service)    SERVICE="$2"; shift 2 ;;
        --ollama-url) OLLAMA_URL="$2"; shift 2 ;;
        --retries)    RETRIES="$2"; shift 2 ;;
        --interval)   INTERVAL="$2"; shift 2 ;;
        --if-running) IF_RUNNING=1; shift ;;
        --expected-model) EXPECTED_MODEL="$2"; shift 2 ;;
        -h|--help)    print_help ;;
        *) fail "Unknown option: $1"; exit 2 ;;
    esac
done

[ -n "$COMPOSE_DIR_OVERRIDE" ] && COMPOSE_DIR="$COMPOSE_DIR_OVERRIDE"
if [ ! -d "$COMPOSE_DIR" ]; then
    fail "Compose dir does not exist: $COMPOSE_DIR_OVERRIDE"
    exit 2
fi
COMPOSE_DIR="$(cd "$COMPOSE_DIR" && pwd)"

if [ ! -f "$COMPOSE_DIR/docker-compose.yml" ]; then
    fail "docker-compose.yml not found at $COMPOSE_DIR/docker-compose.yml"
    exit 2
fi

# ─── Pre-check 1: backend container running? ─────────────────────────────
if ! ( cd "$COMPOSE_DIR" && docker compose ps --services --filter status=running 2>/dev/null \
        | grep -qx "$SERVICE" ); then
    # If ettametta-ollama is running, check if model is loaded directly
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${OLLA_SERVICE}$"; then
        info "Service '$SERVICE' is not running, checking $OLLA_SERVICE directly..."
        if docker exec "$OLLA_SERVICE" ollama list 2>/dev/null | grep -qF "$EXPECTED_MODEL"; then
            pass "$OLLA_SERVICE is running and model '$EXPECTED_MODEL' is loaded (direct probe)"
            exit 0
        fi
    fi

    if [ "$IF_RUNNING" = "1" ]; then
        warn "service '$SERVICE' is not running in $COMPOSE_DIR (service not yet started)"
        warn "  --if-running: passing smoke gate. Services will be started in the build step."
        exit 0
    else
        fail "service '$SERVICE' is not running in $COMPOSE_DIR"
        info "Start it: cd $COMPOSE_DIR && docker compose up -d $SERVICE"
        exit 2
    fi
fi
pass "$SERVICE is running"

# ─── Pre-check 2: ettametta-ollama service present in this compose project?
# Use `docker compose ps -a --services` (NOT `docker ps -a --format …` —
# which would miss Compose's `-1` index suffix on container names) AND NOT
# `docker compose ps --services` (which by default lists running-only and
# would miss a crashed/Exited container we still want to probe and retry).
if ! ( cd "$COMPOSE_DIR" && docker compose ps -a --services 2>/dev/null \
        | grep -qx "$OLLA_SERVICE" ); then
    if [ "$IF_RUNNING" = "1" ]; then
        warn "$OLLA_SERVICE is NOT present in $COMPOSE_DIR (first deploy or ai profile disabled)"
        warn "  --if-running: passing smoke gate. Production hosts should enable"
        warn "  the \`ai\` profile (COMPOSE_PROFILES=ai) on at least one host to"
        warn "  keep this gate honest once the model is available."
        exit 0
    else
        fail "$OLLA_SERVICE is NOT present in $COMPOSE_DIR"
        info "Start it: cd $COMPOSE_DIR && COMPOSE_PROFILES=ai docker compose up -d $OLLA_SERVICE"
        exit 1
    fi
fi
pass "$OLLA_SERVICE is present"

# ─── Retry the probe ──────────────────────────────────────────────────────
# Worst-case timing: each attempt runs `curl --max-time 10` (~10s) plus an
# INTERVAL sleep afterwards (~10s) — only sleep between attempts, not after
# the last, so total ≈ RETRIES * (INTERVAL + 10) - INTERVAL seconds.
MAX_WALL_SECONDS=$(( RETRIES * (INTERVAL + 10) - INTERVAL ))

header "Probing ${OLLAMA_URL} via $SERVICE"
echo "  Worst-case wall-clock: ~${MAX_WALL_SECONDS}s"
echo "  Useful on first boot while ollama pulls the model (~2-5 min cold)."
echo

ATTEMPT=0
LAST_ERR=""
while [ "$ATTEMPT" -lt "$RETRIES" ]; do
    ATTEMPT=$(( ATTEMPT + 1 ))
    if RESP=$( cd "$COMPOSE_DIR" && docker compose exec -T "$SERVICE" \
                node -e "
                  fetch('$OLLAMA_URL', { signal: AbortSignal.timeout(10000) })
                    .then(r => {
                      if (!r.ok) throw new Error('HTTP ' + r.status);
                      return r.text();
                    })
                    .then(console.log)
                    .catch(e => {
                      console.error(e.message);
                      process.exit(1);
                    });
                " 2>&1 ); then
        # Parse models[] length. python3 may be missing in slim backend images;
        # fallback to a naive grep on the response if python3 isn't available.
        if command -v python3 >/dev/null 2>&1; then
            MODELS=$(echo "$RESP" | python3 -c \
                'import sys,json; d=json.load(sys.stdin); print(len(d.get("models",[])))' \
                2>/dev/null || echo "")
        else
            MODELS=$(echo "$RESP" | grep -oE '"name":' | wc -l | tr -d ' ' || echo 0)
        fi

        # Case statement avoids the [ "$X" -gt 0 ] + set -e + non-numeric
        # footgun: a bare `[ ... -gt N ]` errors (vs returns-false) when the
        # operand isn't an integer, and `set -e` can kill the script on error.
        case "$MODELS" in
            ''|*[!0-9]*)
                LAST_ERR="response had no parseable 'models' count: ${RESP:0:120}"
                ;;
            0)
                LAST_ERR="response had empty 'models' array (model still pulling?)"
                ;;
            *)
                # Verify the *expected* model is actually loaded, not just any
                # model. This catches the failure mode where ollama's startup
                # `ollama pull` was blocked (typically Docker-embedded DNS at
                # 127.0.0.11 cannot upstream-resolve `registry.ollama.ai`) and
                # /api/tags returns either [] or a models[] containing only
                # bundled tags that are NOT the one the AI provider chain asks
                # for. The compose `dns:` override on ettametta-ollama is the
                # primary defense; this check guards the gate semantically.
                if echo "$RESP" | grep -qF "\"$EXPECTED_MODEL\"" 2>/dev/null; then
                    echo
                    pass "Ollama healthy and $MODELS model(s) loaded; expected '$EXPECTED_MODEL' present"
                    info "Reached on attempt $ATTEMPT of $RETRIES."
                    echo
                    exit 0
                else
                    LAST_ERR="models list does NOT contain expected '$EXPECTED_MODEL'. Likely: ollama cold-pull blocked at container startup (DNS path issue - see docker-compose.yml 'dns:' override on ettametta-ollama) or AI provider chain was reconfigured to a different model."
                fi
                ;;
        esac
    else
        LAST_ERR="node fetch failed — container may still be starting or model not pulled yet"
    fi
    echo "  attempt $ATTEMPT/$RETRIES ... FAIL — $LAST_ERR"
    if [ "$ATTEMPT" -lt "$RETRIES" ]; then
        sleep "$INTERVAL"
    fi
done

echo
fail "Ollama not reachable after $RETRIES attempts (worst case ~${MAX_WALL_SECONDS}s)"
fail "Last error: $LAST_ERR"
info "Inspect manually:"
info "  cd $COMPOSE_DIR"
info "  docker compose logs $OLLA_SERVICE | tail -50"
info "  docker compose exec $SERVICE curl -v $OLLAMA_URL"
exit 1
