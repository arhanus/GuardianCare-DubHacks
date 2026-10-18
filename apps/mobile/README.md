# GuardianCare frontend

This `frontend` branch contains the full local `feat/subscription-plans` app
from commit `3acdbb5` in `stillhere-expo-fix` (source: `lkim11l/test_stillhere`).
It replaces the single-file Expo 54 prototype with the Expo 57 Router app:
demo onboarding, care dashboards, patient details and charts, alerts and
incident acknowledgments, SOS pairing and alarm preview, profile/settings,
subscriptions, patient editing, personal care flows and motion. Routes live in `src/app/`; entry: `expo-router/entry`.

## Run

From the root of a checkout of `arhanus/GuardianCare-DubHacks`:

```sh
git switch frontend
git pull --ff-only origin frontend
npm ci
npm run web -- --clear
```

For a phone with an Expo Go version compatible with SDK 57:

```sh
npm run start:phone -- --clear
```

Use Node.js 22.13 or newer. Stop previous Expo servers and use the new URL/QR.
Run from the repository root, not an old `mobile/` folder. Preserve local
changes before switching branches; do not reset or clean a working checkout.

## Verify

```sh
npm run typecheck
npm run lint
npm run build:web
```

## Branches and data

`main` is a separate monorepo (`apps/mobile`, `apps/api`, `packages/contracts`)
with an older mobile UI. This import does not change `main` or backend branches.
Integrating this standalone frontend into the monorepo requires a separate change.
See `docs/frontend-transfer.md` for provenance.

All profiles, readings and alerts are fictional. Sign-in is a demo session;
no real authentication, live monitoring or backend is connected. Session and
acknowledgment state is held in memory.
