#!/usr/bin/env bash
# Keep uploaded files when the backend container is recreated.
#
# Uploads (with no S3/R2 bucket configured) live in /app/uploads. Until the compose file
# gave that folder a named volume (backend_uploads), it lived inside the container, and
# every `up --force-recreate` deleted it. The first deploy that adds the volume would
# start it empty, so this script carries the files across:
#
#   save    before the recreate: if the running backend keeps /app/uploads inside the
#           container (no volume mounted there), copy it to .deploy/uploads-pending/.
#           When a volume is already mounted, there is nothing to carry and nothing is
#           copied.
#   restore after the recreate: if .deploy/uploads-pending/ holds files, copy them into
#           the new container (and so its volume), give them to the app user, then keep
#           the copy as .deploy/uploads-restored-<time>/ as a backup. Files already in
#           the volume are never overwritten.
#
# A save that fails stops the deploy (set -e in the caller), so files are never left
# only in a container that is about to be deleted. Nothing here deletes uploads.
#
# Usage (from the compose directory): preserve-uploads.sh save|restore [container]
set -euo pipefail

ACTION="${1:-}"
CONTAINER="${2:-ag-dashboard-backend}"
UPLOADS="${UPLOADS_DIR:-/app/uploads}"  # overridable for the script test only
PENDING=.deploy/uploads-pending

has_files() { [ -d "$1" ] && [ -n "$(find "$1" -type f -print -quit 2>/dev/null)" ]; }

running() { [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ]; }

uploads_on_volume() {
  docker inspect -f '{{range .Mounts}}{{if eq .Destination "'"$UPLOADS"'"}}yes{{end}}{{end}}' "$CONTAINER" 2>/dev/null | grep -q yes
}

case "$ACTION" in
  save)
    if has_files "$PENDING"; then
      echo "Uploads: an earlier deploy's copy is still waiting in $PENDING; keeping it."
      exit 0
    fi
    if ! running; then
      echo "Uploads: $CONTAINER is not running; nothing to carry over."
      exit 0
    fi
    if uploads_on_volume; then
      echo "Uploads: $UPLOADS is already on a volume; the recreate keeps it."
      exit 0
    fi
    mkdir -p "$PENDING"
    if ! docker exec "$CONTAINER" test -d "$UPLOADS"; then
      echo "Uploads: $CONTAINER has no $UPLOADS; nothing to carry over."
      exit 0
    fi
    docker cp "$CONTAINER:$UPLOADS/." "$PENDING/"
    echo "Uploads: copied $(find "$PENDING" -type f | wc -l) file(s) out of $CONTAINER before the recreate."
    ;;
  restore)
    if ! has_files "$PENDING"; then
      echo "Uploads: nothing waiting to restore."
      exit 0
    fi
    if ! running; then
      echo "Uploads: $CONTAINER is not running; leaving the copy in $PENDING for the next deploy." >&2
      exit 1
    fi
    # Copy into a staging folder first, then move only files the volume does not have.
    docker exec -u 0 "$CONTAINER" mkdir -p "$UPLOADS/.restore"
    docker cp "$PENDING/." "$CONTAINER:$UPLOADS/.restore/"
    docker exec -u 0 "$CONTAINER" sh -c '
      cd "$1/.restore" && find . -type f | while read -r f; do
        [ -e "$1/$f" ] || { mkdir -p "$1/$(dirname "$f")" && mv "$f" "$1/$f"; }
      done
      cd "$1" && rm -rf "$1/.restore" && chown -R node:node "$1"
    ' sh "$UPLOADS"
    KEPT=".deploy/uploads-restored-$(date -u +%Y%m%dT%H%M%SZ)"
    mv "$PENDING" "$KEPT"
    echo "Uploads: restored $(find "$KEPT" -type f | wc -l) file(s) into $CONTAINER; backup kept in $KEPT."
    ;;
  *)
    echo "Usage: $0 save|restore [container]" >&2
    exit 2
    ;;
esac
