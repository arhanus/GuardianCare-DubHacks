# Development

## Setup
```bash
git clone <repo-url> && cd guardiancare
nvm use            # Node 22 (see .nvmrc); Expo SDK 57 needs >= 22.13
npm install        # one root package-lock.json
cp apps/api/.env.example apps/api/.env       # fill values
cp apps/mobile/.env.example apps/mobile/.env
```
`npm run dev:api` auto-loads `apps/api/.env` if present (defaults work without it). In production the host supplies env vars.

## Run
```bash
npm run dev:api       # Fastify on :3000
npm run dev:mobile    # Expo dev server (press i / a, or scan QR with Expo Go)
npm run build:api && npm run start:api
npm run typecheck     # all workspaces
```

## Mobile API URL on a physical phone
- `http://localhost:3000` works only on iOS Simulator / web. Android emulator: `http://10.0.2.2:3000`.
- Physical phone on same Wi-Fi: use laptop LAN IP, e.g. `http://192.168.1.50:3000` (`ipconfig getifaddr en0`).
- Deployed: public Render URL `https://<service>.onrender.com`.
Restart Expo after changing `.env` (`npx expo start -c`). `EXPO_PUBLIC_*` values are embedded in the app: never put secrets there.

## Git
Branches: `main` (integration, Arhan), `feature/mobile-arhan`, `feature/backend-aman`.
- Branch off `main`, small PRs into `main`, rebase/merge `main` often.
- Arhan: `apps/mobile`, `hardware/`. Aman: `apps/api`, `supabase/`. Avoid editing the other's folder.
- Never commit `.env` or secrets. Never edit `package-lock.json` by hand; install deps from root: `npm install <pkg> -w @guardiancare/api`.

## Shared contract changes
1. Agree in chat. 2. Edit `packages/contracts/src/index.ts` + `docs/API_CONTRACT.md` in one small PR. 3. Merge to `main` first; both rebase. Contracts are types-only: use `import type`.
