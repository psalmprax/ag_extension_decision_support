#!/usr/bin/env bash
# ============================================================
# Release Script — Merge stage → master with tagging
# ============================================================
# Usage:
#   ./release.sh                    # interactive (prompts for tag)
#   ./release.sh v1.2.3             # with tag
#   ./release.sh v1.2.3 --force     # skip git status checks
#   ./release.sh --dry-run          # show what would happen
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[1;33m'
CYA='\033[0;36m'
RST='\033[0m'
BOLD='\033[1m'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# ── Parse args ──────────────────────────────────────────
TAG=""
DRY_RUN=false
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
    --help|-h)
      echo "Usage: release.sh [<tag>] [--dry-run] [--force]"
      echo ""
      echo "  <tag>       Release tag (e.g. v1.2.3). If omitted, prompted interactively."
      echo "  --dry-run   Show what would happen without making changes."
      echo "  --force     Skip dirty-repo and ahead-of-remote checks."
      exit 0
      ;;
    *)
      if [ -z "$TAG" ]; then
        TAG="$arg"
      else
        echo -e "${RED}Unknown argument: $arg${RST}" >&2
        exit 1
      fi
      ;;
  esac
done

# ── Prompt for tag if not provided ──────────────────────
if [ -z "$TAG" ]; then
  DEFAULT_TAG="v$(date '+%Y%m%d')-$(git rev-parse --short HEAD 2>/dev/null || echo 'dev')"
  read -r -p "Release tag [${DEFAULT_TAG}]: " TAG_INPUT
  TAG="${TAG_INPUT:-$DEFAULT_TAG}"
fi

echo -e "${BOLD}╔══════════════════════════════════════════╗${RST}"
echo -e "${BOLD}║        Release: ${CYA}$TAG${RST}${BOLD}             ║${RST}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RST}"
echo ""

run() {
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YEL}  [DRY RUN] Would run:${RST} $*"
  else
    echo -e "${CYA}  Running:${RST} $*"
    eval "$*"
  fi
}

die() {
  echo -e "${RED}ERROR: $*${RST}" >&2
  exit 1
}

# ── Step 0: Pre-flight checks ──────────────────────────
echo -e "${BOLD}🔍 Step 0/8: Pre-flight checks${RST}"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
echo "  Current branch: $BRANCH"
echo "  Repository:     $(git remote get-url origin 2>/dev/null || echo 'unknown')"

# Check for uncommitted changes
if [ "$FORCE" != true ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo -e "${YEL}  ⚠  Uncommitted changes detected:${RST}"
  git status --short 2>/dev/null | sed 's/^/      /'
  echo ""
  read -r -p "  Stash and proceed? [y/N] " STASH_ANS
  if [ "$STASH_ANS" != "y" ] && [ "$STASH_ANS" != "Y" ]; then
    die "Aborted by user — commit or stash changes first, or use --force"
  fi
  run git stash push -m "release-stash-${TAG}"
  STASHED=true
else
  STASHED=false
fi

# Ensure we're on stage (the source branch for the release)
if [ "$BRANCH" != "stage" ]; then
  echo -e "${YEL}  ⚠  Not on stage branch (on $BRANCH).${RST}"
  read -r -p "  Checkout stage and proceed? [y/N] " CB_ANS
  if [ "$CB_ANS" != "y" ] && [ "$CB_ANS" != "Y" ]; then
    die "Aborted by user — checkout stage first"
  fi
  run git checkout stage
fi

# Check if stage is ahead of origin/stage
if [ "$FORCE" != true ]; then
  run git fetch origin stage 2>/dev/null || true
  AHEAD=$(git rev-list --count origin/stage..stage 2>/dev/null || echo 0)
  if [ "$AHEAD" -gt 0 ]; then
    echo -e "  ${YEL}⚠  stage is $AHEAD commit(s) ahead of origin/stage${RST}"
    read -r -p "  Push uncommitted work first? [y/N] " PUSH_ANS
    if [ "$PUSH_ANS" = "y" ] || [ "$PUSH_ANS" = "Y" ]; then
      run git push origin stage
    fi
  fi
fi

echo ""

# ── Step 1: Sync stage with remote ─────────────────────
echo -e "${BOLD}📥 Step 1/8: Pull latest stage${RST}"
run git pull --rebase origin stage

# ── Step 2: Checkout master ────────────────────────────
echo -e "${BOLD}🔀 Step 2/8: Switch to master${RST}"
run git checkout master

# ── Step 3: Sync master with remote ────────────────────
echo -e "${BOLD}📥 Step 3/8: Pull latest master${RST}"
run git pull --rebase origin master

# ── Step 4: Merge stage into master ────────────────────
echo -e "${BOLD}📦 Step 4/8: Merge stage into master${RST}"
run git merge stage --no-ff -m "Release ${TAG}: merge stage into master"

# ── Step 5: Push master ────────────────────────────────
echo -e "${BOLD}⬆  Step 5/8: Push master to GitHub${RST}"
run git push origin master

# ── Step 6: Tag the release ────────────────────────────
echo -e "${BOLD}🏷️  Step 6/8: Tag release ${CYA}${TAG}${RST}${RST}"
if git tag -l "$TAG" | grep -q "$TAG"; then
  echo -e "  ${YEL}⚠  Tag $TAG already exists locally${RST}"
  read -r -p "  Overwrite? [y/N] " TAG_OVERRIDE
  if [ "$TAG_OVERRIDE" = "y" ] || [ "$TAG_OVERRIDE" = "Y" ]; then
    run git tag -f -a "$TAG" -m "Release ${TAG}"
    run git push origin "$TAG" --force-with-lease
  fi
else
  run git tag -a "$TAG" -m "Release ${TAG}"
  run git push origin "$TAG"
fi

# ── Step 7: Return to stage ────────────────────────────
echo -e "${BOLD}↩  Step 7/8: Return to stage${RST}"
run git checkout stage

# ── Step 8: Pop stash if we stashed ────────────────────
if [ "$STASHED" = true ]; then
  echo -e "${BOLD}📂 Step 8/8: Restore stashed changes${RST}"
  run git stash pop
fi

# ── Done ───────────────────────────────────────────────
echo ""
echo -e "${GRN}✅ Release ${TAG} complete!${RST}"
echo ""
echo "  Summary:"
echo "    ● Merged:  stage → master"
echo "    ● Pushed:  master to GitHub"
echo "    ● Tagged:  ${TAG}"
echo "    ● Branch:  back on stage"
echo ""
echo "  Production deploy triggered automatically via GitHub Actions."
echo "  Monitor at: https://github.com/psalmprax/ag_extension_decision_support/actions"
