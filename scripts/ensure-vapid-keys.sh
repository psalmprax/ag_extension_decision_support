#!/usr/bin/env bash
# Make sure the .env given as $1 has push-notification (VAPID) keys, generating a pair
# only when there is no usable public key yet.
#
# The value is read the way Docker Compose reads it: spaces around it and one pair of
# surrounding quotes are ignored. So `VAPID_PUBLIC_KEY=` and `VAPID_PUBLIC_KEY=""` count as
# missing (keys are generated), while `VAPID_PUBLIC_KEY= BAbc...` keeps its key: replacing
# keys would cut off every phone already subscribed.
#
# Keys come from Python's cryptography package, else from `web-push generate-vapid-keys
# --json`. Both are checked before anything is written (a P-256 public key is 65 bytes,
# 87 base64url characters; a private key is 32 bytes, 43 characters), so a tool that
# prints something else can never be saved as credentials. Exits 1 when no valid pair
# could be made, so a deploy never runs with missing or made-up keys.
set -euo pipefail

env_file="${1:?usage: ensure-vapid-keys.sh <path to .env>}"
contact="${VAPID_CONTACT:-mailto:admin@gpexts.com}"

# The value of KEY in the env file, as Compose would read it (empty when absent).
env_value() {
  local line value
  line=$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$env_file" 2>/dev/null | tail -n 1 || true)
  value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  printf '%s' "$value"
}

valid_pair() {
  [[ "$1" =~ ^[A-Za-z0-9_-]{87}$ && "$2" =~ ^[A-Za-z0-9_-]{43}$ ]]
}

if [ -n "$(env_value VAPID_PUBLIC_KEY)" ]; then
  exit 0
fi

echo "Generating VAPID keys..."
public="" private=""
if python3 -c "import cryptography" 2>/dev/null; then
  read -r public private < <(python3 - <<'PY' 2>/dev/null || true
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

def b64(data):
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

key = ec.generate_private_key(ec.SECP256R1())
point = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
print(b64(point), b64(key.private_numbers().private_value.to_bytes(32, "big")))
PY
  ) || true
fi
if ! valid_pair "$public" "$private" && command -v node >/dev/null 2>&1; then
  read -r public private < <(npx -y web-push generate-vapid-keys --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const k=JSON.parse(s);console.log(k.publicKey,k.privateKey)}catch{console.log("")}})' \
    || true) || true
fi
if ! valid_pair "$public" "$private"; then
  echo "FATAL: Unable to generate valid VAPID keys; refusing deployment with missing or synthetic credentials." >&2
  exit 1
fi

tmp="$(mktemp "${env_file}.XXXXXX")"
grep -vE '^[[:space:]]*VAPID_(PUBLIC_KEY|PRIVATE_KEY|EMAIL)[[:space:]]*=' "$env_file" > "$tmp" 2>/dev/null || true
{
  echo ""
  echo "# VAPID keys for push notifications"
  echo "VAPID_PUBLIC_KEY=$public"
  echo "VAPID_PRIVATE_KEY=$private"
  echo "VAPID_EMAIL=$contact"
} >> "$tmp"
chmod --reference="$env_file" "$tmp" 2>/dev/null || chmod 600 "$tmp"
mv "$tmp" "$env_file"
echo "Added VAPID keys to $env_file"
