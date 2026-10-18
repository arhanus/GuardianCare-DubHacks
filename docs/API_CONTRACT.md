# API Contract

Agreement between Arhan and Aman. **Finalize before independent implementation.** Types live in `@guardiancare/contracts`.
Conventions: camelCase, ISO 8601 UTC timestamps, string IDs, `null` for missing sensor values. Errors: `{ "error": "message" }`.
Auth: devices send `x-device-key: <DEVICE_API_KEY>`; mobile uses Supabase user JWT `Authorization: Bearer <token>` (planned; open during demo until auth lands).

| Endpoint | Status |
|---|---|
| GET /api/health | **implemented** |
| GET /api/patients, /api/patients/:id/readings, GET /api/alerts, PATCH /api/alerts/:id/acknowledge, PATCH /api/alerts/:id/resolve | **implemented** (see `apps/api/README.md`) |
| POST /api/devices/events, /api/devices/readings, /api/devices/heartbeat | **implemented** |
| POST /api/telemetry, GET /api/live (WebSocket), POST /api/patients/:id/sos | **implemented** (below) |

## GET /api/health — implemented
Purpose: liveness/Render health check. Auth: none. Request: none.
`200` -> `{ "status": "ok", "service": "guardiancare-api" }`

## GET /api/patients — planned
Purpose: list patients with room and device. Auth: nurse. `200` -> `Patient[]`
```json
[{ "id": "p-001", "displayName": "Margaret Collins", "room": "101", "deviceId": "guardian-001" }]
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
Request is the firmware's nested JSON (`heart`, `optical`, `temperature`, `imu`, `device`); `deviceId` must equal the configured device. `imu.peak` = `{accelG, jerkG, gyroDps, minAccelG}` extremes since the previous snapshot (`minAccelG` = lowest acceleration magnitude, used to spot free fall). The firmware samples the IMU at 50 Hz (+-8 g) and sends a snapshot immediately on a hit >= 2.5 g instead of waiting for the 1 s tick. Sensors that are unavailable are `null`/`valid:false`; values outside storage bounds (HR 20-250, temp 20-45 C) are stored as `null` rather than rejecting the snapshot. `bpm` may be a float (rounded).
`201 { "ok": true, "receivedAt": "...", "vibrate": false }`. `vibrate` is `true` while this device has an `open` `urgent` alert (red alarm or SOS); the firmware then pulses the vibration motor (500 ms on/off) until a caregiver accepts the alert. `400` malformed; `401` bad key; `403` wrong deviceId; `409` device unassigned.

## PATCH /api/alerts/:id/resolve — implemented
Closes an event with a caregiver note (care-home check record). Auth: nurse (demo nurse id when `REQUIRE_NURSE_AUTH=false`).
Request (`ResolveAlertRequest`): `{ "note": "Checked, no injury" }` (1-500 chars, trimmed).
`200` -> `Alert` with `status: "resolved"`, `resolvedAt`, `resolvedBy`, `resolutionNote` (an `open` alert is acknowledged by the same call). Idempotent: an already resolved alert is returned unchanged. `400` empty note, `404` unknown alert. Pushed as `alert_updated` over `/api/live`.

## Alarm rules (demo-only thresholds, env-configurable, not clinical)
Yellow warnings are disabled by default (`WARNING_ALERTS_ENABLED=false`): only red (`urgent`) alerts are created. The warning rows below apply when it is `true`. A `FALL` needs impact + stillness and at least `FALL_MIN_CONFIDENCE` (2) of: free fall before the impact, gravity direction change; an impact not confirmed within `FALL_WINDOW_SECONDS` (45 s) is forgotten.
`severity`: `urgent` = critical (red; nurse phones ring until acknowledged), `warning` = yellow (listed, no ringing).

| Sensor | Warning | Critical |
|---|---|---|
| Heart rate (`HEART_RATE_ALERT`, `HR_HIGH`/`HR_LOW`) | at rest, < `DEMO_HR_LOW_BPM` (50) or > `DEMO_HR_HIGH_BPM` (120) for `DEMO_HR_DURATION_SECONDS` (20 s) | at rest, < `DEMO_HR_CRITICAL_LOW_BPM` (45) or > `DEMO_HR_CRITICAL_HIGH_BPM` (150) for `DEMO_HR_CRITICAL_DURATION_SECONDS` (15 s) |
| Skin temperature (`TEMPERATURE_ALERT`, `TEMP_HIGH`/`TEMP_LOW`) | `DEMO_TEMP_DELTA_C` (1 °C) away from the wearer's baseline (mean of the first `DEMO_TEMP_BASELINE_SAMPLES` readings) for `DEMO_TEMP_DURATION_SECONDS` (300 s) | never on its own |
| Motion (`MOTION_ALERT`) | `SUDDEN_MOTION`: peak jerk >= `MOTION_JERK_G` (3) or peak acceleration >= `MOTION_IMPACT_G` (3.5 g); sources without 50 Hz peaks fall back to any axis changing >= `MOTION_AXIS_DELTA_G` (0.6 g) between snapshots | `FALL`: an impact (jerk/peak based when firmware peaks are present; ignored while the sensor is off skin) followed by `FALL_STILL_SECONDS` (10 s, counted from the impact) without noticeable movement. Small movements (breathing, a twitching hand) are ignored. Free fall (`minAccelG` < `FALL_FREEFALL_G`) before the impact, or a gravity direction change >= `FALL_ORIENTATION_DEG`, raises confidence (a fall needs `FALL_MIN_CONFIDENCE`). Any snapshot after the first 3 s that changes an axis by >= `FALL_GET_UP_DELTA_G` (0.4 g) or is far from 1 g means the wearer is moving around and cancels the fall |
| Wristband (`DEVICE_ALERT`) | `NOT_WORN`: no skin contact for `NOT_WORN_SECONDS` (120 s); `OFFLINE`: no data for `OFFLINE_SECONDS` (120 s) | never |
| SOS (`SOS`) | - | always critical |

"At rest" = no movement (axis change >= `MOVE_DELTA_G`) for `REST_SECONDS` (10 s). Cooldowns per device and direction.
Alert `type`: `SOS | HEART_RATE_ALERT | MOTION_ALERT | TEMPERATURE_ALERT`; `detail` adds `FALL`, `NOT_WORN`, `OFFLINE`; `type` adds `DEVICE_ALERT`; `source`: `device | simulation | app`.

## GET /api/live — implemented (WebSocket)
Auth: `?token=<Supabase access token>` when `REQUIRE_NURSE_AUTH=true`; otherwise open. Server messages (`LiveMessage` in contracts): `hello`, `ping`, `reading` (`patientId`, `reading` incl. `motionG`), `alert`, `alert_updated`. Single API instance only.

## POST /api/patients/:patientId/sos — implemented
SOS pressed in the app. Request `{ "eventId": "client-generated-unique-id" }` (idempotent). `201 { alert, duplicate:false }`, repeat `200 duplicate:true`; `404` unknown patient; `409` no device. Same auth as other nurse routes. Creates an `urgent` SOS alert with `source:"app"` and pushes it over `/api/live`.

## POST /api/push-tokens, DELETE /api/push-tokens — implemented
Caregiver phones register their Expo push token: body `{ "token": "ExponentPushToken[...]" }` (`400` if it is not an Expo token), answer `204`. `DELETE` with the same body unregisters it (caregiver signs out). Same auth as the other nurse routes. Every registered token receives a push notification for every new alert (title = what happened, body = resident and room, `data.url` = `/incident/<alertId>`; urgent alerts use high priority). Tokens Expo reports as `DeviceNotRegistered` are deleted automatically. Table: `public.push_tokens` (`supabase/migrations/20261018000700_push_tokens.sql`). Expo Go on Android cannot receive remote push (SDK 53+); use a development build there.
