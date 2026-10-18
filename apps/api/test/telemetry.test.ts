import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { parseEnv, type Env } from "../src/config/env.js";
import { createMemoryStore } from "../src/services/memory-store.js";
import { MotionEngine } from "../src/services/motion-engine.js";
import { ThresholdEngine } from "../src/services/threshold-engine.js";
import { FallEngine } from "../src/services/fall-engine.js";
import { TempBaselineEngine } from "../src/services/temp-baseline-engine.js";
import { HrEngine } from "../src/services/hr-engine.js";

const KEY = "test-device-key";
const config: Env = parseEnv({
  NODE_ENV: "test",
  DEVICE_API_KEY: KEY,
  REQUIRE_NURSE_AUTH: "false",
  WARNING_ALERTS_ENABLED: "true",
  MOTION_COOLDOWN_SECONDS: "0",
  DEMO_TEMP_DURATION_SECONDS: "1",
  DEMO_TEMP_MIN_SAMPLES: "2",
  DEMO_TEMP_BASELINE_SAMPLES: "2",
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

test("a big y-axis jump raises one MOTION_ALERT warning", async () => {
  const { app, store } = await setup();
  await post(app, snapshot());
  const spike = snapshot({ imu: { valid: true, motionDetected: true, accel: { x: 0.01, y: 0.9, z: 1.0 }, gyro: { x: 0, y: 0, z: 0 } } });
  assert.equal((await post(app, spike)).statusCode, 201);
  const alerts = await store.listAlerts({ status: "open", limit: 10 });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.type, "MOTION_ALERT");
  assert.equal(alerts[0]?.detail, "SUDDEN_MOTION");
  assert.equal(alerts[0]?.severity, "warning");
  await app.close();
});

test("firmware peak jerk between snapshots also raises a motion alert", async () => {
  const { app, store } = await setup();
  await post(app, snapshot({ imu: { valid: true, motionDetected: true, accel: { x: 0, y: 0, z: 1 }, gyro: null, peak: { accelG: 1.0, jerkG: 3.5, gyroDps: 10 } } }));
  assert.equal((await store.listAlerts({ status: "open", limit: 10 })).length, 1);
  await app.close();
});

test("normal motion raises nothing", async () => {
  const { app, store } = await setup();
  for (let i = 0; i < 5; i++) await post(app, snapshot({ seq: i }));
  assert.equal((await store.listAlerts({ status: "all", limit: 10 })).length, 0);
  await app.close();
});

test("temperature 1 °C above the personal baseline, sustained, raises a TEMPERATURE_ALERT warning", async () => {
  const { app, store } = await setup();
  for (let i = 0; i < 2; i++) await post(app, snapshot({ seq: i, temperature: { valid: true, celsius: 33 } })); // baseline 33
  for (let i = 0; i < 3; i++) {
    await post(app, snapshot({ seq: i, temperature: { valid: true, celsius: 40 } }));
    await new Promise((r) => setTimeout(r, 600));
  }
  const alerts = await store.listAlerts({ status: "open", limit: 10 });
  const temp = alerts.filter((a) => a.type === "TEMPERATURE_ALERT" && a.detail === "TEMP_HIGH");
  assert.equal(temp.length, 1);
  assert.equal(temp[0]?.severity, "warning");
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
        void post(app, snapshot({ imu: { valid: true, motionDetected: true, accel: { x: 0, y: 4, z: 1 }, gyro: null } })).catch(reject);
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

test("FallEngine: impact then stillness is a fall; moving after the impact is not", () => {
  const rule = { moveDeltaG: 0.15, moveMagnitudeG: 0.3, restMs: 10_000, stillMs: 20_000, graceMs: 3000, cooldownMs: 0 };
  const still = { x: 0, y: 0, z: 1 };
  const f = new FallEngine(rule);
  assert.equal(f.ingest("d", 0, still, false), false);
  assert.equal(f.ingest("d", 1000, { x: 0, y: 1.5, z: 1 }, true), false); // impact
  // The arm settling back at 2 s is the last movement (within the grace period, so no cancel).
  for (let t = 2000; t < 21_000; t += 1000) assert.equal(f.ingest("d", t, still, false), false);
  assert.equal(f.ingest("d", 21_000, still, false), true); // 20 s after the impact
  const g = new FallEngine(rule);
  g.ingest("d", 0, still, false);
  g.ingest("d", 1000, { x: 0, y: 1.5, z: 1 }, true);
  g.ingest("d", 2000, still, false);
  g.ingest("d", 8000, { x: 0.5, y: 0, z: 1 }, false); // got up
  for (let t = 9000; t <= 40_000; t += 1000) assert.equal(g.ingest("d", t, { x: 0.5, y: 0, z: 1 }, false), false);
});

test("FallEngine.resting gates heart-rate rules: moving resets the HR streak", () => {
  const f = new FallEngine({ moveDeltaG: 0.15, moveMagnitudeG: 0.3, restMs: 10_000, stillMs: 20_000, graceMs: 3000, cooldownMs: 0 });
  f.ingest("d", 0, { x: 0, y: 0, z: 1 }, false);
  f.ingest("d", 1000, { x: 0.6, y: 0, z: 1 }, false);
  assert.equal(f.resting("d", 5000), false);
  assert.equal(f.resting("d", 11_000), true);
  const hr = new HrEngine({ lowBpm: 50, highBpm: 120, durationMs: 2000, minSamples: 2, cooldownMs: 0 });
  assert.equal(hr.ingest("d", { atMs: 0, heartRateBpm: 130, quality: "good", fresh: true, resting: true }), null);
  assert.equal(hr.ingest("d", { atMs: 1000, heartRateBpm: 130, quality: "good", fresh: true, resting: false }), null);
  assert.equal(hr.ingest("d", { atMs: 3000, heartRateBpm: 130, quality: "good", fresh: true, resting: true }), null); // streak restarted
});

test("TempBaselineEngine learns the personal baseline first", () => {
  const t = new TempBaselineEngine({ baselineSamples: 3, deltaC: 1, durationMs: 1000, minSamples: 2, cooldownMs: 0 });
  for (let i = 0; i < 3; i++) assert.equal(t.ingest("d", i, 32), null);
  assert.equal(t.baseline("d"), 32);
  assert.equal(t.ingest("d", 10, 32.5), null); // within 1 °C
  assert.equal(t.ingest("d", 20, 33.2), null);
  assert.equal(t.ingest("d", 1100, 33.2), "HIGH");
});

test("critical heart rate (urgent) at rest; warning band stays warning", async () => {
  const fast = parseEnv({ NODE_ENV: "test", DEVICE_API_KEY: KEY, REQUIRE_NURSE_AUTH: "false", WARNING_ALERTS_ENABLED: "true", DEMO_HR_DURATION_SECONDS: "1",
    DEMO_HR_CRITICAL_DURATION_SECONDS: "1", DEMO_HR_MIN_SAMPLES: "2", REST_SECONDS: "0" });
  const store = createMemoryStore();
  const app = await buildApp({ store, config: fast });
  for (let i = 0; i < 3; i++) {
    await post(app, snapshot({ seq: i, heart: { valid: true, bpm: 160, status: "VALID" } }));
    await new Promise((r) => setTimeout(r, 600));
  }
  let hr = (await store.listAlerts({ status: "all", limit: 10 })).filter((a) => a.type === "HEART_RATE_ALERT");
  assert.equal(hr.length, 1);
  assert.equal(hr[0]?.severity, "urgent");
  await app.close();

  const store2 = createMemoryStore();
  const app2 = await buildApp({ store: store2, config: fast });
  for (let i = 0; i < 3; i++) {
    await post(app2, snapshot({ seq: i, heart: { valid: true, bpm: 130, status: "VALID" } }));
    await new Promise((r) => setTimeout(r, 600));
  }
  hr = (await store2.listAlerts({ status: "all", limit: 10 })).filter((a) => a.type === "HEART_RATE_ALERT");
  assert.equal(hr.length, 1);
  assert.equal(hr[0]?.severity, "warning");
  await app2.close();
});

test("sensor off skin for NOT_WORN_SECONDS raises one DEVICE_ALERT warning; contact resets it", async () => {
  const cfg = parseEnv({ NODE_ENV: "test", DEVICE_API_KEY: KEY, REQUIRE_NURSE_AUTH: "false", WARNING_ALERTS_ENABLED: "true", NOT_WORN_SECONDS: "1" });
  const store = createMemoryStore();
  const app = await buildApp({ store, config: cfg });
  const off = { valid: false, bpm: null, status: "NO_CONTACT" };
  for (let i = 0; i < 4; i++) {
    await post(app, snapshot({ seq: i, heart: off }));
    await new Promise((r) => setTimeout(r, 450));
  }
  let alerts = (await store.listAlerts({ status: "all", limit: 10 })).filter((a) => a.type === "DEVICE_ALERT");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.detail, "NOT_WORN");
  assert.equal(alerts[0]?.severity, "warning");
  await post(app, snapshot({ seq: 10 })); // contact again
  for (let i = 0; i < 4; i++) {
    await post(app, snapshot({ seq: 20 + i, heart: off }));
    await new Promise((r) => setTimeout(r, 450));
  }
  alerts = (await store.listAlerts({ status: "all", limit: 10 })).filter((a) => a.type === "DEVICE_ALERT");
  assert.equal(alerts.length, 2); // a new episode
  await app.close();
});

test("a wristband silent for OFFLINE_SECONDS raises one OFFLINE warning (not on first check after start)", async () => {
  const cfg = parseEnv({ NODE_ENV: "test", DEVICE_API_KEY: KEY, REQUIRE_NURSE_AUTH: "false", OFFLINE_SECONDS: "60" });
  const store = createMemoryStore();
  const app = await buildApp({ store, config: cfg });
  const check = (app as unknown as { checkOffline: (ms: number) => Promise<void> }).checkOffline;
  await post(app, snapshot());
  const now = Date.now();
  await check(now);                 // alive: nothing
  await check(now + 30_000);        // still within 60 s
  assert.equal((await store.listAlerts({ status: "all", limit: 10 })).length, 0);
  await check(now + 90_000);        // silent for 90 s
  await check(now + 120_000);       // same episode: no duplicate
  const alerts = await store.listAlerts({ status: "all", limit: 10 });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.detail, "OFFLINE");
  assert.equal(alerts[0]?.severity, "warning");
  await app.close();

  const restarted = await buildApp({ store, config: cfg });
  const check2 = (restarted as unknown as { checkOffline: (ms: number) => Promise<void> }).checkOffline;
  await check2(now + 500_000); // first check after a restart only seeds
  assert.equal((await store.listAlerts({ status: "all", limit: 10 })).length, 1);
  await restarted.close();
});

test("resolve closes an alert with a note, is idempotent, validates the note", async () => {
  const { app, store } = await setup();
  const sos = await app.inject({ method: "POST", url: `/api/patients/${PATIENT_C}/sos`, payload: { eventId: "resolve-1" } });
  const id = sos.json().alert.id;
  assert.equal((await app.inject({ method: "PATCH", url: `/api/alerts/${id}/resolve`, payload: { note: "  " } })).statusCode, 400);
  assert.equal((await app.inject({ method: "PATCH", url: `/api/alerts/${id}/resolve`, payload: {} })).statusCode, 400);
  const ok = await app.inject({ method: "PATCH", url: `/api/alerts/${id}/resolve`, payload: { note: "Checked, no injury" } });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().status, "resolved");
  assert.equal(ok.json().resolutionNote, "Checked, no injury");
  assert.ok(ok.json().acknowledgedAt, "an open alert is acknowledged by the same call");
  const again = await app.inject({ method: "PATCH", url: `/api/alerts/${id}/resolve`, payload: { note: "other" } });
  assert.equal(again.json().resolutionNote, "Checked, no injury");
  assert.equal((await store.listAlerts({ status: "open", limit: 5 })).length, 0);
  assert.equal((await app.inject({ method: "PATCH", url: "/api/alerts/11111111-1111-4111-8111-999999999999/resolve", payload: { note: "x" } })).statusCode, 404);
  await app.close();
});

test("FallEngine: free fall + lying down (orientation change) gives confidence 3 and alerts after stillMs", () => {
  const f = new FallEngine({ moveDeltaG: 0.15, moveMagnitudeG: 0.3, restMs: 10_000, stillMs: 10_000, graceMs: 3000, cooldownMs: 0, getUpDeltaG: 0.4, orientationDeg: 45 });
  const upright = { x: 0, y: 0, z: 1 };
  const lying = { x: 1, y: 0, z: 0 };
  f.ingest("d", 0, upright, false);
  f.ingest("d", 1000, { x: 0, y: 1.5, z: 1 }, true, true); // free fall then impact
  for (let t = 2000; t < 11_000; t += 1000) assert.equal(f.ingest("d", t, lying, false), false);
  assert.equal(f.ingest("d", 12_000, lying, false), true); // 10 s after the last movement
  assert.equal(f.lastConfidence("d"), 3);
});

test("FallEngine: small movements after the impact are ignored; a noticeable one cancels", () => {
  const rule = { moveDeltaG: 0.15, moveMagnitudeG: 0.3, restMs: 10_000, stillMs: 10_000, graceMs: 3000, cooldownMs: 0, getUpDeltaG: 0.4 };
  const still = { x: 0, y: 0, z: 1 };
  const fidget = (t: number) => ({ x: 0.05 + (t % 2000 === 0 ? 0.2 : 0), y: 0, z: 1 }); // hand twitching, 0.2 g
  const f = new FallEngine(rule);
  f.ingest("d", 0, still, false);
  f.ingest("d", 1000, { x: 0, y: 1.5, z: 1 }, true);
  for (let t = 2000; t < 11_000; t += 1000) assert.equal(f.ingest("d", t, fidget(t), false), false);
  assert.equal(f.ingest("d", 11_000, fidget(11_000), false), true); // fidgeting does not stop the fall
  const g = new FallEngine(rule);
  g.ingest("d", 0, still, false);
  g.ingest("d", 1000, { x: 0, y: 1.5, z: 1 }, true);
  for (let t = 2000; t < 7000; t += 1000) g.ingest("d", t, still, false);
  assert.equal(g.ingest("d", 7000, { x: 0.6, y: 0, z: 1 }, false), false); // sits up / walks away
  for (let t = 8000; t <= 30_000; t += 1000) assert.equal(g.ingest("d", t, { x: 0.6, y: 0, z: 1 }, false), false);
});

test("MotionEngine.wasImpact ignores slow axis changes when firmware peaks are present", () => {
  const m = new MotionEngine({ axisDeltaG: 0.6, jerkG: 3, impactG: 3.5, cooldownMs: 0 });
  m.ingest("d", { atMs: 0, accel: { x: 0, y: 0, z: 1 }, peakAccelG: 1.1, peakJerkG: 0.2 });
  m.ingest("d", { atMs: 1000, accel: { x: 0.9, y: 0, z: 0.4 }, peakAccelG: 1.2, peakJerkG: 0.3 }); // wrist turn
  assert.equal(m.wasTripped("d"), false); // axis change alone is not enough when peaks are reported
  assert.equal(m.wasImpact("d"), false);
  m.ingest("d", { atMs: 2000, accel: { x: 0, y: 0, z: 1 }, peakAccelG: 4.1, peakJerkG: 3 });
  assert.equal(m.wasImpact("d"), true);
});

test("by default no yellow warning is raised, even for a big movement", async () => {
  const store = createMemoryStore();
  const app = await buildApp({ store, config: parseEnv({ NODE_ENV: "test", DEVICE_API_KEY: KEY, REQUIRE_NURSE_AUTH: "false" }) });
  await post(app, snapshot());
  await post(app, snapshot({ imu: { valid: true, motionDetected: true, accel: { x: 0, y: 4, z: 1 }, gyro: null, peak: { accelG: 6, jerkG: 5, gyroDps: 300, minAccelG: 0.1 } } }));
  assert.equal((await store.listAlerts({ status: "all", limit: 10 })).length, 0);
});

test("FallEngine: impact + stillness without free fall or orientation change is not a fall when minConfidence is 2", () => {
  const f = new FallEngine({ moveDeltaG: 0.15, moveMagnitudeG: 0.3, restMs: 10_000, stillMs: 20_000, graceMs: 3000, cooldownMs: 0, minConfidence: 2, windowMs: 45_000 });
  const still = { x: 0, y: 0, z: 1 };
  f.ingest("d", 0, still, false);
  f.ingest("d", 1000, { x: 0, y: 1.5, z: 1 }, true); // hand wave, then the hand rests in the same position
  for (let t = 2000; t <= 40_000; t += 1000) assert.equal(f.ingest("d", t, still, false), false);
});

test("FallEngine: an impact never confirmed within the window is forgotten", () => {
  const f = new FallEngine({ moveDeltaG: 0.15, moveMagnitudeG: 0.3, restMs: 10_000, stillMs: 10_000, graceMs: 3000, cooldownMs: 0, minConfidence: 2, windowMs: 30_000 });
  const still = { x: 0, y: 0, z: 1 };
  f.ingest("d", 0, still, false);
  f.ingest("d", 1000, { x: 0, y: 1.5, z: 1 }, true);
  for (let t = 2000; t < 32_000; t += 1000) assert.equal(f.ingest("d", t, still, false), false); // no free fall, no orientation change
  // Lying down only after the window has passed no longer counts.
  for (let t = 32_000; t <= 60_000; t += 1000) assert.equal(f.ingest("d", t, { x: 1, y: 0, z: 0 }, false), false);
});
