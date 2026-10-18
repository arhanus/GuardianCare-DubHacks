import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { parseEnv, type Env } from "../src/config/env.js";
import { createMemoryStore } from "../src/services/memory-store.js";
import { MotionEngine } from "../src/services/motion-engine.js";
import { ThresholdEngine } from "../src/services/threshold-engine.js";

const KEY = "test-device-key";
const config: Env = parseEnv({
  NODE_ENV: "test",
  DEVICE_API_KEY: KEY,
  REQUIRE_NURSE_AUTH: "false",
  MOTION_COOLDOWN_SECONDS: "0",
  DEMO_TEMP_DURATION_SECONDS: "1",
  DEMO_TEMP_MIN_SAMPLES: "2",
});
const PATIENT_C = "11111111-1111-4111-8111-111111111203";

// Exactly what hardware/esp32 firmware sends (one snapshot per second).
const snapshot = (over: Record<string, unknown> = {}) => ({
  deviceId: "guardian-001",
  firmware: "V3",
  seq: 7,
  uptimeMs: 12345,
  heart: { valid: true, bpm: 72.4, status: "VALID", signalRms: 12.1, periodicity: 0.8, redIrCorrelation: 0.9, sampleRateHz: 102.3 },
  optical: { valid: true, rawIR: 50000, rawRED: 40000 },
  temperature: { valid: true, celsius: 33.56 },
  imu: { valid: true, motionDetected: false, accel: { x: 0.01, y: 0.02, z: 1.0 }, gyro: { x: 0, y: 0, z: 0 } },
  device: { motorOn: false, csvRecording: false, i2cErrors: 0, fifoOverflows: 0, ppgSamples: 100, wifiRssi: -55 },
  ...over,
});

async function setup() {
  const store = createMemoryStore();
  const app = await buildApp({ store, config });
  return { app, store };
}
const post = (app: Awaited<ReturnType<typeof setup>>["app"], payload: unknown, headers: Record<string, string> = { "x-api-key": KEY }) =>
  app.inject({ method: "POST", url: "/api/telemetry", headers, payload: payload as object });

test("accepts the firmware JSON (X-API-Key, float bpm) and stores a rounded reading", async () => {
  const { app, store } = await setup();
  const res = await post(app, snapshot());
  assert.equal(res.statusCode, 201);
  const [r] = await store.listReadings(PATIENT_C, 5);
  assert.equal(r?.heartRateBpm, 72);
  assert.equal(r?.skinTemperatureC, 33.56);
  assert.deepEqual(r?.accelerationG, { x: 0.01, y: 0.02, z: 1.0 });
  assert.equal(r?.signalQuality, "good");
  assert.equal(r?.source, "device");
  await app.close();
});

test("telemetry: missing/wrong key 401, wrong deviceId 403", async () => {
  const { app } = await setup();
  assert.equal((await post(app, snapshot(), {})).statusCode, 401);
  assert.equal((await post(app, snapshot(), { "x-api-key": "nope" })).statusCode, 401);
  assert.equal((await post(app, snapshot({ deviceId: "guardiancare-01" }))).statusCode, 403);
  await app.close();
});

test("invalid sensors become null instead of rejecting the snapshot", async () => {
  const { app, store } = await setup();
  const res = await post(
    app,
    snapshot({
      heart: { valid: false, bpm: null, status: "NO_CONTACT" },
      temperature: { valid: true, celsius: 12.5 }, // sensor off-skin
      imu: { valid: false, motionDetected: false, accel: null, gyro: null },
    }),
  );
  assert.equal(res.statusCode, 201);
  const [r] = await store.listReadings(PATIENT_C, 5);
  assert.equal(r?.heartRateBpm, null);
  assert.equal(r?.skinTemperatureC, null);
  assert.equal(r?.accelerationG, null);
  assert.equal(r?.signalQuality, "poor");
  await app.close();
});

test("malformed telemetry is a 400", async () => {
  const { app } = await setup();
  assert.equal((await post(app, { deviceId: "guardian-001", heart: { valid: "yes" } })).statusCode, 400);
  await app.close();
});

test("a big y-axis jump raises one urgent MOTION_ALERT", async () => {
  const { app, store } = await setup();
  await post(app, snapshot());
  const spike = snapshot({ imu: { valid: true, motionDetected: true, accel: { x: 0.01, y: 0.9, z: 1.0 }, gyro: { x: 0, y: 0, z: 0 } } });
  assert.equal((await post(app, spike)).statusCode, 201);
  const alerts = await store.listAlerts({ status: "open", limit: 10 });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.type, "MOTION_ALERT");
  assert.equal(alerts[0]?.detail, "SUDDEN_MOTION");
  assert.equal(alerts[0]?.severity, "urgent");
  await app.close();
});

test("firmware peak jerk between snapshots also raises a motion alert", async () => {
  const { app, store } = await setup();
  await post(app, snapshot({ imu: { valid: true, motionDetected: true, accel: { x: 0, y: 0, z: 1 }, gyro: null, peak: { accelG: 1.0, jerkG: 2.2, gyroDps: 10 } } }));
  assert.equal((await store.listAlerts({ status: "open", limit: 10 })).length, 1);
  await app.close();
});

test("normal motion raises nothing", async () => {
  const { app, store } = await setup();
  for (let i = 0; i < 5; i++) await post(app, snapshot({ seq: i }));
  assert.equal((await store.listAlerts({ status: "all", limit: 10 })).length, 0);
  await app.close();
});

test("sustained high temperature raises a TEMPERATURE_ALERT", async () => {
  const { app, store } = await setup();
  for (let i = 0; i < 3; i++) {
    await post(app, snapshot({ seq: i, temperature: { valid: true, celsius: 40 } }));
    await new Promise((r) => setTimeout(r, 600));
  }
  const alerts = await store.listAlerts({ status: "open", limit: 10 });
  assert.equal(alerts.filter((a) => a.type === "TEMPERATURE_ALERT" && a.detail === "TEMP_HIGH").length, 1);
  await app.close();
});

test("app SOS creates an urgent alert, is idempotent, and 404s for unknown patients", async () => {
  const { app, store } = await setup();
  const url = `/api/patients/${PATIENT_C}/sos`;
  const first = await app.inject({ method: "POST", url, payload: { eventId: "app-sos-1" } });
  assert.equal(first.statusCode, 201);
  const again = await app.inject({ method: "POST", url, payload: { eventId: "app-sos-1" } });
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().duplicate, true);
  const alerts = await store.listAlerts({ status: "open", limit: 10 });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.source, "app");
  assert.equal(alerts[0]?.type, "SOS");
  const unknown = await app.inject({ method: "POST", url: "/api/patients/11111111-1111-4111-8111-999999999999/sos", payload: { eventId: "x" } });
  assert.equal(unknown.statusCode, 404);
  await app.close();
});

test("acknowledge works without a token only when nurse auth is off", async () => {
  const { app, store } = await setup();
  const sos = await app.inject({ method: "POST", url: `/api/patients/${PATIENT_C}/sos`, payload: { eventId: "app-sos-2" } });
  const id = sos.json().alert.id;
  const ack = await app.inject({ method: "PATCH", url: `/api/alerts/${id}/acknowledge`, payload: {} });
  assert.equal(ack.statusCode, 200);
  assert.equal(ack.json().status, "acknowledged");
  assert.equal((await store.listAlerts({ status: "open", limit: 5 })).length, 0);
  await app.close();

  const strict = await buildApp({ store: createMemoryStore(), config: { ...config, REQUIRE_NURSE_AUTH: true } });
  const denied = await strict.inject({ method: "PATCH", url: `/api/alerts/${id}/acknowledge`, payload: {} });
  assert.equal(denied.statusCode, 401);
  await strict.close();
});

test("live hub receives readings and alerts over WebSocket", async () => {
  const { app } = await setup();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/live`);
  const seen: string[] = [];
  await new Promise<void>((resolve, reject) => {
    ws.onmessage = (e) => {
      const msg = JSON.parse(String(e.data));
      seen.push(msg.type);
      if (msg.type === "hello") {
        void post(app, snapshot({ imu: { valid: true, motionDetected: true, accel: { x: 0, y: 1.5, z: 1 }, gyro: null } })).catch(reject);
      }
      if (seen.includes("reading") && seen.includes("alert")) resolve();
    };
    ws.onerror = () => reject(new Error("ws error"));
    setTimeout(() => reject(new Error(`timeout, saw ${seen}`)), 4000);
  });
  ws.close();
  await app.close();
});

test("ThresholdEngine / MotionEngine unit rules", () => {
  const t = new ThresholdEngine({ low: 30, high: 38, durationMs: 1000, minSamples: 2, cooldownMs: 5000 });
  assert.equal(t.ingest("d", 0, 40), null);
  assert.equal(t.ingest("d", 1500, 40), "HIGH");
  assert.equal(t.ingest("d", 1600, 40), null); // streak reset after alert
  assert.equal(t.ingest("d", 1700, null), null);
  const m = new MotionEngine({ axisDeltaG: 0.6, jerkG: 1.5, impactG: 1.8, cooldownMs: 1000 });
  assert.equal(m.ingest("d", { atMs: 0, accel: { x: 0, y: 0, z: 1 } }), false);
  assert.equal(m.ingest("d", { atMs: 100, accel: { x: 0, y: 0.7, z: 1 } }), true);
  assert.equal(m.ingest("d", { atMs: 200, accel: { x: 0, y: 0, z: 1 } }), false); // cooldown
  assert.equal(m.ingest("d", { atMs: 5000, accel: null, peakAccelG: 1.95 }), true);
});
