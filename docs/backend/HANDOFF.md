# Backend handoff (Aman)

## Run
`cp apps/api/.env.example apps/api/.env`, fill Supabase + device key, `npm run dev:api`. Startup prints the LAN URL for the ESP32/phone (plain HTTP, same 2.4 GHz network).
Supabase: paste `supabase/migrations/*.sql` in filename order (all idempotent). One demo nurse in Authentication > Users (Auto Confirm).

## Checks
- `npm run typecheck && npm run build:api && npm test -w @guardiancare/api`
- Device side + nurse side against a running API: README "Smoke test", and `bash apps/api/scripts/smoke-nurse.sh`.

## Behaviour to know
- Device online = `last_seen_at` newer than `DEVICE_ONLINE_TIMEOUT_SECONDS` (30). Computed per request.
- SOS retries: same `eventId` returns the same alert (`duplicate:true`); DB UNIQUE + ON CONFLICT makes concurrent retries safe. Use a new `eventId` per button press.
- Acknowledge is idempotent and never reopens; `acknowledgedBy` = verified Supabase user id.
- Demo HR rule state is in memory (resets on restart). Not clinical.
- If the API or Wi-Fi is down the device gets no response; firmware must retry the same `eventId`.
- Reset between demo runs: paste `docs/backend/reset-demo.sql` in the SQL Editor. Set `ALLOW_SIMULATED_DATA=false` for the real demo.

## Demo-only hardening gaps (not production)
Any signed-in user can read all synthetic rows (no per-nurse isolation); one shared device key; CORS open; no rate limiting; HTTP only; no HIPAA claims.

## Not done
HTTPS deployment (Render), background push, per-device keys, rate limiting, contract decision (see CONTRACT_PROPOSALS.md).
