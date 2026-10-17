# API Contract

Agreement between Arhan and Aman. **Finalize before independent implementation.** Types live in `@guardiancare/contracts`.
Conventions: camelCase, ISO 8601 UTC timestamps, string IDs, `null` for missing sensor values. Errors: `{ "error": "message" }`.
Auth: devices send `x-device-key: <DEVICE_API_KEY>`; mobile uses Supabase user JWT `Authorization: Bearer <token>` (planned; open during demo until auth lands).

| Endpoint | Status |
|---|---|
| GET /api/health | **implemented** |
| all others | planned |

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
