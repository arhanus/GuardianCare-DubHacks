// Copy to secrets.h (git-ignored) and fill in. Never commit secrets.h.
#pragma once

const char *WIFI_SSID     = "your-2.4GHz-wifi";
const char *WIFI_PASSWORD = "your-wifi-password";

// The computer running `npm run dev:api` (same network). The API prints "LAN: http://x.x.x.x:3000" on start.
const char *SERVER_URL = "http://192.168.1.10:3000/api/telemetry";

// Must equal DEVICE_API_KEY in apps/api/.env.
const char *API_KEY = "";
