#!/usr/bin/env bash
# Vendor SheetJS xlsx so installs no longer depend on cdn.sheetjs.com.
#
# The lockfiles already pin the CDN tarball's sha512, so tampering is caught by
# `npm ci`; what is NOT covered is availability — if the CDN is down or the URL
# disappears, every install (CI, Docker, local) fails. This script:
#   1. downloads the tarball (or takes XLSX_TARBALL=/path/to/file),
#   2. verifies it against the sha512 already recorded in package-lock.json,
#   3. stores it in ag-extension-dashboard/src/backend/vendor/,
#   4. repoints the backend dependency at file:vendor/<tarball>,
#   5. regenerates the root and backend lockfiles,
#   6. makes the backend Dockerfile copy vendor/ before `npm ci`.
# Run once from the repo root, review `git diff`, commit.
set -euo pipefail

VERSION="${XLSX_VERSION:-0.20.2}"
NAME="xlsx-${VERSION}.tgz"
URL="https://cdn.sheetjs.com/xlsx-${VERSION}/${NAME}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/ag-extension-dashboard/src/backend"
VENDOR_DIR="$BACKEND/vendor"
DOCKERFILE="$BACKEND/Dockerfile"

expected="$(node -e '
  const lock = require(process.argv[1]);
  const e = lock.packages["node_modules/xlsx"];
  if (!e || !e.integrity) { console.error("no xlsx integrity in lockfile"); process.exit(1); }
  process.stdout.write(e.integrity);
' "$ROOT/package-lock.json")"

mkdir -p "$VENDOR_DIR"
target="$VENDOR_DIR/$NAME"
if [ -n "${XLSX_TARBALL:-}" ]; then
  cp "$XLSX_TARBALL" "$target"
else
  echo "Downloading $URL"
  curl -fsSL "$URL" -o "$target"
fi

actual="sha512-$(openssl dgst -sha512 -binary "$target" | base64 | tr -d '\n')"
if [ "$actual" != "$expected" ]; then
  rm -f "$target"
  echo "FATAL: integrity mismatch for $NAME" >&2
  echo "  expected (lockfile): $expected" >&2
  echo "  actual   (download): $actual" >&2
  exit 1
fi
echo "Verified $NAME against the lockfile sha512."

node -e '
  const fs = require("fs"); const p = process.argv[1]; const spec = process.argv[2];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.dependencies.xlsx = spec;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
' "$BACKEND/package.json" "file:vendor/$NAME"

# npm keeps an existing hoisted xlsx entry (resolved to the CDN) even after the
# spec changes to file:, so drop it from both lockfiles to force re-resolution.
drop_xlsx_entries() {
  node -e '
    const fs = require("fs"); const p = process.argv[1];
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const k of Object.keys(j.packages)) if (k.endsWith("node_modules/xlsx")) delete j.packages[k];
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  ' "$1"
}
drop_xlsx_entries "$ROOT/package-lock.json"
drop_xlsx_entries "$BACKEND/package-lock.json"

# Backend lockfile: regenerate outside the workspace so npm updates it, not the root one.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp "$BACKEND/package.json" "$BACKEND/package-lock.json" "$tmp/"
mkdir -p "$tmp/vendor" && cp "$target" "$tmp/vendor/"
(cd "$tmp" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null)
cp "$tmp/package-lock.json" "$BACKEND/package-lock.json"
(cd "$ROOT" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null)

copy_line='COPY ${BACKEND_DIR}/vendor/ ./vendor/'
anchor='COPY ${BACKEND_DIR}/package*.json ./'
if ! grep -qF "$copy_line" "$DOCKERFILE"; then
  grep -qF "$anchor" "$DOCKERFILE" || { echo "FATAL: Dockerfile anchor not found: $anchor" >&2; exit 1; }
  awk -v a="$anchor" -v c="$copy_line" '{ print } $0 == a { print c }' "$DOCKERFILE" > "$tmp/Dockerfile"
  cp "$tmp/Dockerfile" "$DOCKERFILE"
fi

if grep -q "cdn.sheetjs.com" "$ROOT/package-lock.json" "$BACKEND/package-lock.json"; then
  echo "FATAL: a lockfile still references cdn.sheetjs.com" >&2
  exit 1
fi
echo "Done. xlsx now installs from ag-extension-dashboard/src/backend/vendor/$NAME."
echo "Review with: git diff --stat && git status --short"
