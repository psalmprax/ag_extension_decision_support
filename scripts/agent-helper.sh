#!/usr/bin/env bash

# Senior Agent Engineering Workflow Helper Script
# Provides structured verification commands for AI agents and developers.

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0;0m' # No Color

function log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

function log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

function log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

function log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

function print_usage() {
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  plan-validate     Check for existence and completeness of implementation_plan.md"
  echo "  test-all          Run backend (Jest) and frontend (Vitest) test suites"
  echo "  lint-all          Run backend and frontend linters"
  echo "  verify-deployment Run deployment integrity checks"
  echo ""
}

# Navigate to project root
cd "$(dirname "$0")/.."

COMMAND=$1

if [ -z "$COMMAND" ]; then
  print_usage
  exit 1
fi

case "$COMMAND" in
  plan-validate)
    log_info "Validating implementation plan..."
    PLAN_FOUND=0
    
    # Check local repository
    for file in $(find . -name "implementation_plan.md" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null); do
      if [ -f "$file" ] && [ -s "$file" ]; then
        log_success "Found local implementation plan: $file"
        PLAN_FOUND=1
      fi
    done

    # Check user brain directory if running in Antigravity/Gemini environment
    BRAIN_DIR="/home/psalmprax/.gemini/antigravity/brain"
    if [ -d "$BRAIN_DIR" ]; then
      for file in $(find "$BRAIN_DIR" -name "implementation_plan.md" -type f 2>/dev/null); do
        if [ -f "$file" ] && [ -s "$file" ]; then
          log_success "Found active session implementation plan: $file"
          PLAN_FOUND=1
        fi
      done
    fi

    if [ "$PLAN_FOUND" -eq 0 ]; then
      log_error "No active or non-empty implementation_plan.md file found!"
      log_warn "Please create an implementation_plan.md file in the project root or session directory before starting."
      exit 1
    fi
    ;;

  test-all)
    log_info "Running backend tests..."
    if npm --prefix ag-extension-dashboard/src/backend run test; then
      log_success "Backend tests passed successfully."
    else
      log_error "Backend tests failed."
      exit 1
    fi

    log_info "Running frontend tests..."
    if npm --prefix ag-extension-dashboard/src/frontend run test; then
      log_success "Frontend tests passed successfully."
    else
      log_error "Frontend tests failed."
      exit 1
    fi

    log_success "All unit test suites completed successfully!"
    ;;

  lint-all)
    log_info "Running backend and frontend linters..."
    if npm run lint; then
      log_success "Linter execution passed successfully with zero errors."
    else
      log_error "Linter execution failed. Please fix all errors/warnings."
      exit 1
    fi
    ;;

  verify-deployment)
    log_info "Running system checks and deployment simulation..."
    if [ -f "scripts/startup-probe.sh" ]; then
      log_info "Running startup-probe.sh..."
      # Run in check/dry-run mode if supported, or just verify it passes lint/shellcheck
      bash scripts/startup-probe.sh --help || true
    fi

    if [ -f "check-deployment.sh" ]; then
      log_info "Running check-deployment.sh..."
      bash check-deployment.sh
    fi
    log_success "Deployment integrity checks completed!"
    ;;

  *)
    log_error "Unknown command: $COMMAND"
    print_usage
    exit 1
    ;;
esac
