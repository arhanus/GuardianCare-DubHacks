# GuardianCare

Screenless ESP32-S3 smart wristband + React Native nurse app. DubHacks 2026 prototype (synthetic data only, not a medical device).

First milestone: physical SOS button press -> backend -> alert on nurse's phone.

| Path | Purpose | Owner |
|---|---|---|
| `apps/mobile` | Expo React Native app (`@guardiancare/mobile`) | Arhan |
| `apps/api` | Fastify backend (`@guardiancare/api`) | Aman |
| `packages/contracts` | Shared TS types (`@guardiancare/contracts`) | Both |
| `hardware/esp32` | Firmware notes | Arhan |
| `supabase/migrations` | SQL migrations | Aman |
| `docs/` | Architecture, API contract, dev + deploy guides | Both |

## Quick start (Node 22 required)

```bash
nvm use          # reads .nvmrc (22)
npm install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
npm run dev:api      # http://localhost:3000/api/health
npm run dev:mobile   # Expo dev server
npm run typecheck
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
