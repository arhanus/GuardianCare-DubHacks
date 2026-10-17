# Architecture

```
ESP32-S3 wristband --HTTPS/Wi-Fi--> Fastify API (Render) --> Supabase Postgres
                                         |                        |
                                         |                  Supabase Realtime
Nurse mobile app (Expo) <-- REST ------- +                        |
        ^------------------ realtime subscription ----------------+
```

- Device -> API only (`POST /api/devices/events`, `/readings`), authenticated with a scoped device key.
- API owns writes; it uses the Supabase service-role key (backend only).
- Mobile reads via API and subscribes to Supabase Realtime using the anon key under RLS.
- No web dashboard. Wristband has no display.

## Timestamps (device clocks)
ESP32 clocks are unreliable until NTP syncs. Rules:
1. Device sends ISO 8601 UTC `timestamp` after NTP sync; before sync it omits it or sends a boot-relative value flagged by the firmware.
2. Backend always records its own `receivedAt` and treats it as authoritative for ordering/alerting.
3. If device timestamp differs from `receivedAt` by more than a threshold (proposed 5 min) or is in the future, backend stores `receivedAt` as the effective time.
4. `eventId` (device-generated, unique) makes retries idempotent; dedupe on it.

## Security notes
- Service-role key: backend only. Mobile gets anon key; access governed by RLS (to be written with schema).
- Devices use a scoped device credential (`DEVICE_API_KEY` for now; per-device keys later).
- Demo data is synthetic. No real PHI.
