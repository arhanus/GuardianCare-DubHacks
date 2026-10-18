# Frontend transfer

Compared revisions:
- Source lkim11l/test_stillhere feat/mobile-caregiver: 7f6626f9b74b0c976055234cd3b30d794ba6ae14.
  Expo 57, Router, onboarding, dashboards and charts in src/.
- Team frontend before import: 916e213318dc5e8c82cb1928350aaaa8d07ff8f5.
  Expo 54; node_modules/expo/AppEntry.js loads the old root App.tsx.
- Team main at inspection: 9641501.
  Expo 58 monorepo; apps/mobile/components/GuardianApp.tsx still implements
  the earlier blue UI with Alex Morgan, Jordan Lee and Taylor Kim.

The branches contain different applications and entry points. An up-to-date
push of the old frontend does not transfer files from the source repository.
This explains the code-level UI mismatch. Arhan's running device/server was
not inspected.

Copied src/, assets/, docs/design-adaptations.md, AGENTS.md, .gitignore,
app.json, package.json, package-lock.json, tsconfig.json and eslint.config.js.
Removed the obsolete App.tsx, updated documentation, and added verification CI.
Excluded the source test_stillhere gitlink: it points back to the old team
frontend commit and is not application code. No source history was merged.
No main or backend refs or files were updated. Backend integration remains
separate; the imported app uses local demo data.

## Local checkout evidence

At inspection, Desktop/GuardianCare-DubHacks was at 916e213 and git status
reported ?? mobile/. A running Expo process loaded mobile/node_modules/expo.
That nested folder contains the newer Expo 57 Router app, but is untracked
in the parent repository. Thus the locally running app was not the tracked
root application available to teammates. The local folder was left intact.

## Verification of imported revision

On 2026-10-17 (America/Los_Angeles), Node 24.16.0 / npm 12.0.2:
- npm ci --no-audit --no-fund: passed.
- npm run typecheck: passed.
- npm run lint: passed.
- npm run build:web: passed; Metro bundled 2716 modules and exported dist/.
- npx expo install --check: passed using the installed SDK dependency map;
  network validation was unavailable, so this was an offline compatibility check.
- Imported application files and lockfile match source commit exactly.

No physical-device or interactive browser validation was performed.

## Correction: full local app restored

The remote feat/mobile-caregiver head did not contain the latest local work.
A second audit found the complete app in stillhere-expo-fix on local branch
feat/subscription-plans at 3acdbb5. The first import therefore omitted profile,
settings, subscription, patient editor, personal care flows, SOS pairing,
recipient preview, alarm audio, motion and subsequent UX fixes.

This correction imports that local commit's src/, assets/, package manifest
and lockfile, app config, design-system/, scripts/, feature documentation and
Vercel config. The original local checkout is unchanged. No source histories
are merged and no main/backend refs are updated. Source code and dependencies
are preserved exactly from the complete local version.

Correction validation (Node 24.16.0): npm ci, TypeScript, ESLint and all
7 existing policy tests passed. Web export passed (2763 modules), including
the SOS alarm audio. No interactive or physical-device testing was repeated.
Native export also passed: iOS 3165 modules, Android 3301 modules. These are
Metro/Hermes bundle checks, not installed-device execution.
