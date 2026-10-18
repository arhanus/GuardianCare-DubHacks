# ESP32-S3 Wristband Firmware

Sketch: `guardiancare_wristband/guardiancare_wristband.ino` (V3, hand-back PPG + telemetry). Experimental prototype, not a medical device.

## Setup
- Arduino IDE 2.x, Espressif ESP32 board package, board **ESP32S3 Dev Module**, USB CDC On Boot: Enabled (if you use the native USB port), Serial Monitor 115200.
- Libraries: SparkFun MAX3010x, OneWire, DallasTemperature (WiFi / HTTPClient ship with the ESP32 core).
- Wiring: MAX30102 + MPU6500/6050 on SDA GPIO8 / SCL GPIO9, DS18B20 on GPIO4, vibration motor driver on GPIO5.
- **Credentials:** copy `guardiancare_wristband/secrets.example.h` to `secrets.h` (git-ignored) and fill in Wi-Fi, `SERVER_URL` and `API_KEY`. Never commit `secrets.h`.
  - `SERVER_URL` = `http://<computer-LAN-IP>:3000/api/telemetry`. `npm run dev:api` prints the LAN address.
  - `API_KEY` must equal `DEVICE_API_KEY` in `apps/api/.env`; `DEVICE_ID` in the sketch must equal `DEVICE_ID` there (`guardian-001`).
  - The ESP32 needs a 2.4 GHz network on the same LAN as the computer running the API.

## What it sends
One JSON snapshot per second: `POST /api/telemetry`, header `x-device-key`. Heart rate, optical, temperature, IMU (`accel`, `gyro`, and `peak` = largest accel/jerk/gyro since the last snapshot so short impacts are not missed) and device status. Unavailable sensors are sent as `null`. The backend turns this into a stored reading, pushes it to the nurse phones, and raises alarms (sudden motion, heart rate, temperature). See `docs/API_CONTRACT.md`.

## Serial commands
`1` start CSV recording, `q` stop, `v` vibrate 2 s, `s` stop vibration, `w` WiFi on/off (to check whether the radio disturbs BPM/temperature). The status line shows `HTTP:<code> ok:<n> fail:<n>`; `201` means the backend accepted the snapshot.

## Testing
1. `curl http://<ip>:3000/api/health`.
2. Without hardware: `npm run replay:telemetry -w @guardiancare/api` sends firmware-shaped snapshots (add `-- --spike` for a sudden-motion alarm).
3. Flash, watch the serial `HTTP:201` counter, and confirm live values in the app.
