#!/usr/bin/env bash
# Keep a current copy of the free DB-IP Lite city database in the folder given as $1
# (mounted read-only into the backend at /app/geoip). It turns a demo visitor's IP into an
# approximate country, region and city on the server, so no IP is sent to a lookup service.
#
# DB-IP Lite is CC BY 4.0: wherever its places are shown, credit "IP Geolocation by DB-IP"
# (https://db-ip.com). A new edition comes out each month; this script fetches the current
# one (or last month's early in the month) when the copy is older than 25 days.
#
# Never fails a deploy: without the database, demo visits are recorded without a place.
set -uo pipefail

dir="${1:?usage: fetch-geoip.sh <folder>}"
target="$dir/dbip-city-lite.mmdb"
mkdir -p "$dir"

if [ -s "$target" ] && [ -n "$(find "$target" -mtime -25 2>/dev/null)" ]; then
  echo "City database is current: $target"
  exit 0
fi

tmp="$(mktemp "$dir/.dbip.XXXXXX")"
trap 'rm -f "$tmp" "$tmp.gz"' EXIT
for month in "$(date -u +%Y-%m)" "$(date -u -d "$(date -u +%Y-%m-01) -1 day" +%Y-%m 2>/dev/null)"; do
  [ -n "$month" ] || continue
  url="https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz"
  if curl -fsSL --max-time 300 --retry 2 -o "$tmp.gz" "$url" && gunzip -c "$tmp.gz" > "$tmp" 2>/dev/null; then
    # A real city database is tens of megabytes; anything small is an error page.
    if [ "$(stat -c %s "$tmp" 2>/dev/null || echo 0)" -gt 10000000 ]; then
      chmod 644 "$tmp"
      mv "$tmp" "$target"
      echo "City database updated to the ${month} edition: $target"
      exit 0
    fi
  fi
done

echo "City database not updated; demo visits keep the previous copy, or no place if there is none." >&2
exit 0
