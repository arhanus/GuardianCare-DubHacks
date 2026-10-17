# Deployment

## API on Render (not yet deployed)
Free/starter instances may sleep or restart; do not rely on them staying up. Wake the service before the demo.

1. Push repo to GitHub. Render -> New Web Service -> connect repo.
2. **Root Directory:** leave blank (repo root) so npm workspaces and the root lockfile resolve.
3. **Build Command:** `npm install && npm run build:api`
4. **Start Command:** `npm run start:api`
5. **Node:** set env `NODE_VERSION=22`.
6. **Env vars:** `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_API_KEY`. Do not set `PORT`; Render injects it and the app binds `0.0.0.0:$PORT`.
7. **Health Check Path:** `/api/health`
8. Test: `curl https://<service>.onrender.com/api/health` -> `{"status":"ok","service":"guardiancare-api"}`

## Mobile with EAS (future)
- `npm i -g eas-cli`; from `apps/mobile`: `eas init`, `eas build:configure` (creates `eas.json`).
- Set `EXPO_PUBLIC_*` via EAS env vars (`eas env:create`), not in Git.
- Monorepo: EAS uploads the workspace; run EAS commands from `apps/mobile`.
- Bundle IDs: `com.guardiancare.app` (iOS/Android) in `app.json`; change if taken.
- Apple Developer/Google Play credentials are not required until the first store/device build. Prefer Expo Go or a dev build for the hackathon.
- Push notifications (expo-notifications) not implemented yet.
