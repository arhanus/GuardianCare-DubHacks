# ESP32-S3 Wristband Firmware

No firmware yet. Place the Arduino sketch in `hardware/esp32/guardiancare_wristband/`.

- **Setup:** Arduino IDE 2.x, ESP32 board package (Espressif), board "ESP32S3 Dev Module". Libraries: MAX30105/MAX30102 driver, MPU6050, TMP117 (optional), WiFi, HTTPClient (HTTPS).
- **Hardware:** MAX30102 (heart rate), MPU6050 (motion), TMP117 (optional), SOS button (GPIO, debounced, interrupt/INPUT_PULLUP). No display.
- **Network:** Wi-Fi to backend HTTPS API. Sync time via NTP. Retry with the same `eventId` on failure (backend is idempotent).
- **Contract:** `POST /api/devices/events` and `/api/devices/readings`; see `docs/API_CONTRACT.md`. Example event: `{"eventId":"guardian-001-evt-123","deviceId":"guardian-001","eventType":"SOS","timestamp":"2026-10-17T12:00:00Z"}`
- **Auth:** header `x-device-key`. Keep credentials in an untracked `secrets.h`, never in Git.
- **Testing:** 1) `curl` the deployed/LAN `/api/health`. 2) Fire a fake SOS with curl. 3) Flash firmware, press button, watch serial log + backend log. 4) Confirm alert appears in app.
