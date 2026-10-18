# CLAUDE.md - GuardianCare

## Product
Screenless ESP32-S3 wristband (MAX30102 heart rate, MPU6050 motion, optional TMP117, physical SOS button) sends events/readings over Wi-Fi to a Fastify backend. Nurses use an Expo React Native mobile app. Prototype for DubHacks 2026; NOT a clinically validated medical device. All patients are synthetic.

**Mobile-only UI. No web frontend or dashboard. The wristband has no display.**
First milestone: physical SOS -> mobile alert.

## Team
- Arhan: lead, architecture, mobile, hardware, DevOps, testing, presentation.
- Aman: backend, database, APIs, realtime, alert processing.
Two devs, both using Claude Code, working in parallel on branches `feature/mobile-arhan`, `feature/backend-aman`; Arhan integrates to `main`.

## Layout
npm workspaces monorepo: `apps/mobile` (Expo Router, TS), `apps/api` (Fastify, Zod, Supabase, ESM/NodeNext), `packages/contracts` (types only), `hardware/esp32`, `supabase/migrations`, `docs/`.

## Stack
Expo SDK 57 (matches App Store Expo Go) / React Native / Expo Router / Supabase JS; Node 22, Fastify 5, Zod 4, Supabase Postgres + Realtime; Render (api), EAS (mobile). Arduino framework for firmware.

## Rules
- Shared contracts: `packages/contracts` is types-only (import with `import type`). Change it only with both devs' agreement; update `docs/API_CONTRACT.md` in the same PR.
- JSON: camelCase, ISO 8601 UTC timestamps, string IDs, explicit `null` for missing sensor values.
- Never put secrets in mobile env (`EXPO_PUBLIC_*` is public). Service-role key is backend-only. No secrets in Git; use `.env.example`.
- Do not add Nx/Turborepo/pnpm/Yarn/Docker/K8s or other infra without asking. Keep it simple.
- No unrelated edits or refactors. Preserve existing work; do not delete files without reason.
- Test every change: `npm run typecheck`, `npm run build:api`, hit endpoints, `cd apps/mobile && npx expo-doctor`.
- Do not commit, push, or deploy without explicit permission.
- Mobile deps: use `npx expo install <pkg>` to get SDK-compatible versions. Root `overrides` pins `react` to match Expo; keep in sync when upgrading SDK.
