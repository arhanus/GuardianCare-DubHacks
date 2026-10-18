#!/usr/bin/env bash
# Run API + app when the phone cannot reach this computer over Wi-Fi (guest/venue networks block it).
# Opens a public tunnel to the API, then starts Expo in tunnel mode pointed at that URL.
# Extra args go to Expo, e.g.: npm run dev:tunnel -- --port 8082
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
LOG="$(mktemp)"

PORT="$PORT" npm run dev:api &
API_PID=$!
npx --yes localtunnel --port "$PORT" >"$LOG" 2>&1 &
LT_PID=$!
trap 'kill "$API_PID" "$LT_PID" 2>/dev/null || true; rm -f "$LOG"' EXIT INT TERM

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -o 'https://[^ ]*' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then echo "Could not open the API tunnel:"; cat "$LOG"; exit 1; fi

echo
echo "API public URL:  $URL   (anyone with this link can reach the demo API; it stops when you press Ctrl+C)"
echo "ESP32 SERVER_URL (secrets.h, only if the wristband is on a network that allows it):  http://${URL#https://}/api/telemetry"
echo

EXPO_PUBLIC_API_URL="$URL" npm run start:phone -w @guardiancare/mobile -- "$@"
