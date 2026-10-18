# Expo Go diagnosis (2026-10-17)

## Scope and observed facts

- Remote refs were fetched from GitHub. main at 3a43a4d contains only README.md: there is no mobile application to start there.
- feat/mobile-caregiver at d589b1c targets Expo SDK 57. The existing local checkout was at 5838607 with SDK 58 and unrelated uncommitted UI changes. Those changes were preserved; this fix was prepared in a separate worktree.
- A fresh npm install on d589b1c selected Reanimated 4.7.1 and Worklets 0.13.0 through peer dependencies. npm reported that Worklets 0.13.0 conflicts with expo-modules-core's supported range. The installed SDK 57 bundledNativeModules.json specifies Reanimated 4.5.1 and Worklets 0.10.1. These versions are now direct dependencies and package-lock.json records the complete tree.
- The app entry is expo-router/entry; routes are in src/app. app.json enables the router plugin and declares the stillhere scheme. No alternative app.config, custom Babel/Metro configuration, or native project overrides were present.
- Source inspection found no fetch/axios calls, backend URL configuration, browser storage, or DOM dependencies. Sessions and alerts are demo state in memory. Missing backend configuration does not block this demo's startup.
- Vercel exports the web application. Its HTTPS URL is not an Expo Go native manifest URL.

## Fix

- Reproducible SDK 57 lockfile and explicit SDK-compatible animation peers.
- start:phone forces Expo Go, clears Metro cache, and starts a tunnel. The ngrok helper is installed with the project so startup does not depend on an interactive global installation.
- start:lan supplies an alternative for a shared private Wi-Fi network.
- CI and Vercel use npm ci. CI checks Android/iOS exports as well as web, lint, TypeScript and Expo dependency compatibility.
- Documentation no longer assumes which SDK the phone's current store installation supports.

## Verification

- Fresh dependency install completed on Windows, Node 24.16.0.
- expo install --check: dependencies up to date.
- expo-doctor: 21/21 checks passed.
- TypeScript and ESLint completed successfully on the fixed worktree.
- Web production bundle compiled successfully (2,716 modules).
- Android and iOS production Hermes exports passed (3,271 and 3,135 modules respectively). Exports were run with --max-workers 2 to limit local worker usage.
- start:phone: Metro started; ngrok tunnel connected and became ready.
- Android manifest advertised sdkVersion 57.0.0, src/app router root and expo-router/entry bundle.
- Expo open endpoint selected runtime expo and returned an exp:// tunnel URL.
- Downloaded the development Android Hermes bundle through that tunnel: HTTP 200, 10,799,881 bytes.

A device was not attached. These checks establish dependency alignment, manifest delivery and bundling; they do not establish successful execution in the user's Expo Go. The exact original phone error, installed Expo Go version and phone network were unavailable. SDK mismatch or network failure on that phone therefore remains unconfirmed.

## Phone checklist

Use the fixed branch, Node >=22.13, npm ci, then npm run start:phone. Confirm Expo Go supports SDK 57. Scan the new CLI QR with Expo Go on Android or Camera on iOS; keep Metro running. If iOS requests authentication, sign into the same Expo account on the CLI and phone. For LAN use the same non-guest Wi-Fi, allow Node on the private Windows Firewall network, and avoid VPN/client isolation. Do not use localhost on a separate phone. If failure persists, record the first Metro/phone error, phone platform and Expo Go version.

References: https://docs.expo.dev/versions/v57.0.0/ and https://docs.expo.dev/more/expo-cli/
