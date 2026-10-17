# @guardiancare/api

Fastify 5 + Zod 4 + Supabase backend. Binds `0.0.0.0` and speaks plain HTTP on the LAN (HTTPS comes with deployment).

## Quickstart
```bash
nvm use && npm ci                     # from repo root
cp apps/api/.env.example apps/api/.env   # fill in locally; .env is git-ignored
npm run dev:api                       # prints Local + LAN base URLs
curl -i http://localhost:3000/api/health
```
Expected: `200 {"status":"ok","service":"guardiancare-api"}`.

The startup log prints a line like `LAN: http://192.168.x.x:3000`. Use that URL from the ESP32 and phone (same 2.4 GHz hotspot).

## Scripts (run from repo root)
| Command | What |
|---|---|
| `npm run dev:api` | tsx watch, auto-loads `apps/api/.env` |
| `npm run typecheck` | all workspaces |
| `npm run build:api` / `npm run start:api` | compile to `dist/` and run |
| `npm test -w @guardiancare/api` | node:test via tsx |

## Environment
See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` accepts the new `sb_secret_...` key. Never log or commit secrets; the logger redacts `authorization` and `x-device-key` headers.

## Supabase setup
Paste into the Supabase SQL Editor, in order: `supabase/migrations/20261017000100_schema.sql`, then `20261017000200_seed.sql`. Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (your `sb_secret_...` key) in `apps/api/.env`. Without them (non-production only) the API uses an in-memory store and logs a warning.

## Smoke test
```bash
# server: DEVICE_API_KEY=local-test-key ALLOW_SIMULATED_DATA=true npm run dev:api
export API=http://localhost:3000 KEY=local-test-key
curl -s -X POST $API/api/devices/heartbeat -H "x-device-key: $KEY" -H 'content-type: application/json' -d '{"deviceId":"guardian-001"}'
curl -s -X POST $API/api/devices/events    -H "x-device-key: $KEY" -H 'content-type: application/json' -d '{"eventId":"guardian-001-evt-test-001","deviceId":"guardian-001","eventType":"SOS"}'   # run twice: same alert id, duplicate:true
curl -s "$API/api/alerts?status=open"
curl -s $API/api/patients
DEVICE_API_KEY=$KEY npm run simulate:sos -w @guardiancare/api    # source:"simulation"
```
`Authorization: Bearer $KEY` is also accepted in place of `x-device-key`.

## Nurse auth, acknowledge, readings
Nurse routes need `Authorization: Bearer <Supabase user access token>` (validated by Supabase Auth). Create one demo nurse in Supabase Auth (Authentication > Users) and sign in from the app. With Supabase unconfigured (non-production only) the token `dev-nurse-token` works.
```bash
N='authorization: Bearer dev-nurse-token'
curl -s $API/api/alerts -H "$N"
curl -s -X PATCH $API/api/alerts/<alertId>/acknowledge -H "$N" -H 'content-type: application/json' -d '{}'   # repeat: same record, 200
curl -s -X POST $API/api/devices/readings -H "x-device-key: $KEY" -H 'content-type: application/json' \
  -d '{"readingId":"guardian-001-reading-0001","deviceId":"guardian-001","heartRateBpm":82,"signalQuality":"good"}'   # 201, repeat 200
curl -s "$API/api/patients/11111111-1111-4111-8111-111111111203/readings?limit=20" -H "$N"
```
Demo HR rule (`DEMO_HR_*` env, example values only, not clinical): alerts only after >= 3 good-quality samples over >= 10 s all above/below the threshold; poor/unknown/null/stale samples reset it; 60 s cooldown. State is in memory (resets on restart). Run the extra migration `20261017000300_alert_detail.sql` too.
