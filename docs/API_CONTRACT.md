# API Contract

Agreement between Arhan and Aman. **Finalize before independent implementation.** Types live in `@guardiancare/contracts`.
Conventions: camelCase, ISO 8601 UTC timestamps, string IDs, `null` for missing sensor values. Errors: `{ "error": "message" }`.
Auth: devices send `x-device-key: <DEVICE_API_KEY>`; mobile uses Supabase user JWT `Authorization: Bearer <token>` (planned; open during demo until auth lands).

| Endpoint | Status |
|---|---|
| GET /api/health | **implemented** |
| GET /api/patients, /api/patients/:id/readings, GET /api/alerts, PATCH /api/alerts/:id/acknowledge | **implemented** (see `apps/api/README.md`) |
| POST /api/devices/events, /api/devices/readings, /api/devices/heartbeat | **implemented** |
| POST /api/telemetry, GET /api/live (WebSocket), POST /api/patients/:id/sos | **implemented** (below) |

## GET /api/health — implemented
Purpose: liveness/Render health check. Auth: none. Request: none.
`200` -> `{ "status": "ok", "service": "guardiancare-api" }`

## GET /api/patients — planned
Purpose: list patients with room and device. Auth: nurse. `200` -> `Patient[]`
```json
[{ "id": "p-001", "displayName": "Demo Patient A", "room": "101", "deviceId": "guardian-001" }]
```

## GET /api/patients/:id — planned
Auth: nurse. `200` -> `Patient`; `404` unknown id.

## GET /api/patients/:id/readings — planned
Query: `limit` (int, default 100, max 1000), `since` (ISO timestamp, optional). Auth: nurse.
`200` -> `SensorReading[]` newest first; `404` unknown patient.
```json
[{ "deviceId": "guardian-001", "timestamp": "2026-10-17T12:00:00Z", "heartRateBpm": 78, "motionG": 1.02, "temperatureC": null }]
```

## GET /api/alerts — planned
Query: `status` (`open|acknowledged|resolved`, optional), `limit`. Auth: nurse. `200` -> `Alert[]` newest first.
```json
[{ "id": "a-1", "patientId": "p-001", "deviceId": "guardian-001", "type": "SOS", "status": "open",
   "createdAt": "2026-10-17T12:00:01Z", "acknowledgedAt": null, "acknowledgedBy": null }]
```

## POST /api/devices/events — planned
Purpose: device reports an event (SOS button, etc.). Auth: device key.
Request (`DeviceEvent`):
```json
{ "eventId": "guardian-001-evt-123", "deviceId": "guardian-001", "eventType": "SOS", "timestamp": "2026-10-17T12:00:00Z" }
```
`eventType`: `SOS | HEART_RATE_ALERT | HEARTBEAT`.
Responses: `202` accepted (also for duplicate `eventId`, idempotent) `{ "accepted": true }`; `400` invalid body; `401` bad key; `404` unknown device.

## POST /api/devices/readings — planned
Purpose: device uploads sensor sample(s). Auth: device key.
Request: `{ "deviceId": "guardian-001", "timestamp": "2026-10-17T12:00:00Z", "heartRateBpm": 78, "motionG": 1.02, "temperatureC": null }`
Responses: `202` `{ "accepted": true }`; `400`; `401`; `404`.

## PATCH /api/alerts/:id/acknowledge — planned
Auth: nurse. Request (`AcknowledgeAlertRequest`): `{ "acknowledgedBy": "Nurse Kim" }`
`200` -> updated `Alert` with `status: "acknowledged"`; `404` unknown alert; `409` already acknowledged/resolved.


## POST /api/telemetry — implemented
Purpose: ESP32 firmware snapshot, once per second. Auth: device key via `x-device-key` (also `x-api-key` or `Authorization: Bearer`).
Request is the firmware's nested JSON (`heart`, `optical`, `temperature`, `imu`, `device`); `deviceId` must equal the configured device. `imu.peak` = `{accelG, jerkG, gyroDps}` maxima since the previous snapshot. Sensors that are unavailable are `null`/`valid:false`; values outside storage bounds (HR 20-250, temp 20-45 C) are stored as `null` rather than rejecting the snapshot. `bpm` may be a float (rounded).
`201 { "ok": true, "receivedAt": "..." }`; `400` malformed; `401` bad key; `403` wrong deviceId; `409` device unassigned.

## Alarm rules (demo-only thresholds, env-configurable, not clinical)
Run on every new reading; each creates an `urgent` alert and pushes it over `/api/live`:
- `MOTION_ALERT` / `SUDDEN_MOTION`: any axis changes >= `MOTION_AXIS_DELTA_G` (0.6 g) between snapshots, peak jerk >= `MOTION_JERK_G`, or acceleration >= `MOTION_IMPACT_G` (1.8 g). Cooldown `MOTION_COOLDOWN_SECONDS`.
- `HEART_RATE_ALERT` / `HR_HIGH|HR_LOW`: `DEMO_HR_*`, sustained.
- `TEMPERATURE_ALERT` / `TEMP_HIGH|TEMP_LOW`: outside `DEMO_TEMP_LOW_C`-`DEMO_TEMP_HIGH_C`, sustained `DEMO_TEMP_DURATION_SECONDS`.
Alert `type`: `SOS | HEART_RATE_ALERT | MOTION_ALERT | TEMPERATURE_ALERT`; `source`: `device | simulation | app`.

## GET /api/live — implemented (WebSocket)
Auth: `?token=<Supabase access token>` when `REQUIRE_NURSE_AUTH=true`; otherwise open. Server messages (`LiveMessage` in contracts): `hello`, `ping`, `reading` (`patientId`, `reading` incl. `motionG`), `alert`, `alert_updated`. Single API instance only.

## POST /api/patients/:patientId/sos — implemented
SOS pressed in the app. Request `{ "eventId": "client-generated-unique-id" }` (idempotent). `201 { alert, duplicate:false }`, repeat `200 duplicate:true`; `404` unknown patient; `409` no device. Same auth as other nurse routes. Creates an `urgent` SOS alert with `source:"app"` and pushes it over `/api/live`.
