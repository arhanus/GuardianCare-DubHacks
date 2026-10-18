#!/usr/bin/env bash
# Run API (background) and Expo (foreground, interactive) together. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run dev:api &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM

npm run dev:mobile
