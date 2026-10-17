# Contract proposals (Aman -> Arhan)

`packages/contracts` and `docs/API_CONTRACT.md` are NOT modified by backend work. The sprint doc and the repo contract disagree; B0 follows the repo. Decide which side moves before B2 (ingestion) since the mobile app codes against whichever is final.

| Topic | Repo (current, implemented in B0) | Sprint doc (proposed) |
|---|---|---|
| Health body | `{status:"ok",service}` | `{ok:true,service}` |
| Error body | `{error:"message"}` | `{error:{code,message}}` |
| Device auth header | `x-device-key: <key>` | `Authorization: Bearer <key>` |
| Event body | `timestamp` (required) | `occurredAt` (nullable; ESP32 may lack NTP) |
| eventType | `SOS\|HEART_RATE_ALERT\|HEARTBEAT` | `SOS` only in P0 |
| Event response | `202 {accepted:true}` (also dup) | `201 {alert}` new / `200 {alert}` duplicate |
| Heartbeat | via `eventType: HEARTBEAT` | `POST /api/devices/heartbeat` -> `{ok,serverTime}` |
| Alert status | `open\|acknowledged\|resolved` | `active\|acknowledged` (+ `severity`, `source`, `eventId`) |
| Alert ack | body `{acknowledgedBy:"name"}`, `409` if already acked | body `{}`, user from JWT, idempotent 200 |
| Patient | `{id,displayName,room,deviceId}`, array | `{patients:[{...,roomNumber,device{lastSeenAt,isOnline},latestReading,activeAlertCount}]}` |
| Reading | `{deviceId,timestamp,heartRateBpm,motionG,temperatureC}` | `readingId`, `skinTemperatureC`, `accelerationG{x,y,z}`, `signalQuality`, `source`, `receivedAt` |
| Patient ids | `p-001` examples | UUID, fixed Room 203 id |
| Supabase env | `SUPABASE_SERVICE_ROLE_KEY` | same name, plus `SUPABASE_ANON_KEY` (added in B0) |
| Port | 3000 | 3001 (repo wins: 3000) |

Recommendation: adopt the sprint-doc shapes (idempotent alert-returning events, JWT-derived `acknowledgedBy`, `source` labeling, nullable timestamps). Proposed `packages/contracts` diff will be written here once you choose; nothing is changed until then.

## Additive superset implemented in B2 (no contract file changed)
So the app can code against either contract, B2 returns the repo shapes plus extra fields:
- `POST /api/devices/events`: accepts `timestamp` or `occurredAt` (both optional/null), `x-device-key` or `Bearer`. Returns `202 {accepted, duplicate, alert}`.
- `POST /api/devices/heartbeat` exists (sprint shape) in addition to `eventType: HEARTBEAT`.
- `GET /api/alerts` returns a bare array of `{id,patientId,deviceId,eventId,type,severity,status,source,createdAt,acknowledgedAt,acknowledgedBy}`; `status` accepts `open|active|acknowledged|resolved|all`. DB and wire status value is `open`.
- `GET /api/patients` returns a bare array with `id,displayName,room,deviceId` plus `roomNumber,device{id,lastSeenAt,isOnline},latestReading:null,activeAlertCount`.
- GET endpoints are currently open (repo: "open during demo until auth lands"); nurse JWT arrives with B1-lite/B3.

## Added in B3/B4 (additive)
- `PATCH /api/alerts/:alertId/acknowledge`: `acknowledgedBy` comes from the verified Supabase user (UUID), body ignored. Repeats return `200` with the existing record (sprint behaviour) instead of the repo's `409`.
- `POST /api/devices/readings`: sprint shape (`readingId` required for idempotent retries); `201` new / `200` duplicate -> `{reading}`. Reading objects also carry repo aliases `timestamp`, `temperatureC`, `motionG`.
- `GET /api/patients/:patientId/readings?limit=` returns a bare array (max 100).
- Demo HR alerts use `type:"HEART_RATE_ALERT"` (repo) with additive `detail:"HR_HIGH"|"HR_LOW"`, `severity:"warning"`, `eventId:null`.
- Nurse GET routes now require a Supabase token (`REQUIRE_NURSE_AUTH=true` default).
