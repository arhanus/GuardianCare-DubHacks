/**
 * Sends firmware-shaped telemetry to /api/telemetry once a second, so the whole chain
 * (API -> WebSocket -> phone, alarms included) can be tested without the wristband.
 *
 *   DEVICE_API_KEY=... npm run replay:telemetry -w @guardiancare/api            # calm readings
 *   DEVICE_API_KEY=... npm run replay:telemetry -w @guardiancare/api -- --spike # y-axis jump after 5 s
 *   flags: --temp (high skin temperature)  --hr (high heart rate)  --count=N  --api=http://host:3000
 */
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const API = opt("api", process.env.API_URL ?? "http://localhost:3000");
const KEY = process.env.DEVICE_API_KEY ?? "";
const DEVICE = process.env.DEVICE_ID ?? "guardian-001";
const COUNT = Number(opt("count", "60"));
if (!KEY) {
  console.error("Set DEVICE_API_KEY (same value as apps/api/.env).");
  process.exit(1);
}

let seq = 0;
async function tick() {
  const spike = flag("spike") && seq === 5;
  const wobble = Math.sin(seq / 3);
  const body = {
    deviceId: DEVICE,
    firmware: "replay",
    seq,
    uptimeMs: seq * 1000,
    heart: { valid: true, bpm: flag("hr") ? 140 : 72 + wobble * 3, status: "VALID" },
    optical: { valid: true, rawIR: 50000, rawRED: 40000 },
    temperature: { valid: true, celsius: flag("temp") ? 39.5 : 33.5 + wobble * 0.2 },
    imu: {
      valid: true,
      motionDetected: spike,
      accel: { x: 0.02, y: spike ? 1.4 : 0.03 + wobble * 0.01, z: 1.0 },
      gyro: { x: 0, y: spike ? 120 : 0, z: 0 },
      peak: { accelG: spike ? 1.9 : 1.0, jerkG: spike ? 2.4 : 0.02, gyroDps: spike ? 120 : 1 },
    },
    device: { motorOn: false, wifiRssi: -55 },
  };
  const res = await fetch(`${API}/api/telemetry`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-key": KEY },
    body: JSON.stringify(body),
  });
  console.log(`#${seq} -> ${res.status}${spike ? "  (sudden motion spike)" : ""}`);
  seq++;
}

for (let i = 0; i < COUNT; i++) {
  await tick().catch((e) => console.error("failed:", e.message));
  await new Promise((r) => setTimeout(r, 1000));
}
