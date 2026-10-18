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
Paste into the Supabase SQL Editor, in order: `20261017000100_schema.sql`, `20261017000200_seed.sql`, `20261017000300_alert_detail.sql`, then `20261017000400_sensor_alerts.sql` (adds motion/temperature alert types and the in-app SOS source; without it those alarms cannot be stored). Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (your `sb_secret_...` key) in `apps/api/.env`. Without them (non-production only) the API uses an in-memory store and logs a warning.

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

## Wristband telemetry, live push, alarms
- Firmware posts to `POST /api/telemetry` (header `x-device-key`, same value as `DEVICE_API_KEY`). Each snapshot is stored, pushed to phones, and checked against the alarm rules (sudden motion, heart rate, skin temperature).
- Phones connect to `GET /api/live` (WebSocket) for `reading`, `alert` and `alert_updated` messages. The mobile app has no login yet, so run with `REQUIRE_NURSE_AUTH=false` locally.
- No hardware? `DEVICE_API_KEY=<key> npm run replay:telemetry -w @guardiancare/api` streams firmware-shaped data; add `-- --spike` (sudden motion), `-- --temp` or `-- --hr` to trigger alarms.
- Thresholds are demo-only env vars (`MOTION_*`, `DEMO_TEMP_*`, `DEMO_HR_*`); see `.env.example`. The ESP32, phone and this computer must share one 2.4 GHz LAN.
- Sensor-alert storage errors are logged (`FAILED to create sensor alert`) instead of failing the wristband POST.
