#!/bin/sh
# SMS, USSD and phone sign-in user stories, run against a local backend.
#
# Nothing reaches a real phone or AI provider: fake-gateway.cjs is preloaded into the
# backend and writes every outbound SMS to $SMS_SIM_OUTBOX, and AI answers come from a
# stub marked "[SIMULATED AI ANSWER ...]". Uses the real-world fixture accounts, so seed
# them first (cd ag-extension-dashboard/src/backend && npx ts-node prisma/seed-realworld.ts).
#
# Usage: DATABASE_URL=postgresql://... scripts/sms-simulation/run.sh
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
BACKEND="$HERE/../../ag-extension-dashboard/src/backend"
: "${DATABASE_URL:?Set DATABASE_URL to a local database with the real-world fixtures}"
export SMS_SIM_OUTBOX="${SMS_SIM_OUTBOX:-/tmp/sms-sim/outbox.jsonl}"
export SIM_API="${SIM_API:-http://127.0.0.1:3901}"
mkdir -p "$(dirname "$SMS_SIM_OUTBOX")"; rm -f "$SMS_SIM_OUTBOX"

cd "$BACKEND"
SMS_SIM_AI=stub PORT=3901 \
AFRICASTALKING_API_KEY=sim-key AFRICASTALKING_USERNAME=sandbox AFRICASTALKING_WEBHOOK_SECRET=sim-at-secret \
TWILIO_AUTH_TOKEN=sim-twilio-token AIHUBMIX_API_KEY=sim-aihubmix-key SMS_PROVIDER_RATE_PER_MINUTE=1000 RATE_LIMIT_DISABLED=true \
NODE_OPTIONS="${NODE_OPTIONS:-} -r $HERE/fake-gateway.cjs" \
  npx ts-node -r tsconfig-paths/register --transpile-only src/index.ts > /tmp/sms-sim/backend.log 2>&1 &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 90); do curl -sf "$SIM_API/api/health" >/dev/null && break; sleep 2; done
NODE_PATH="$BACKEND/node_modules" node "$HERE/stories.mjs"
