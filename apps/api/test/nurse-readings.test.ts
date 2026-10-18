import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { parseEnv, type Env } from "../src/config/env.js";
import { HrEngine, type HrRule } from "../src/services/hr-engine.js";
import { createMemoryStore } from "../src/services/memory-store.js";
import type { NurseVerifier } from "../src/services/nurse-auth.js";

const KEY = "test-device-key";
const NURSE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const verifier: NurseVerifier = { verify: async (t) => (t === "nurse-token" ? { id: NURSE_A } : null) };
const dev = { "x-device-key": KEY };
const nurse = { authorization: "Bearer nurse-token" };
const PATIENT_C = "11111111-1111-4111-8111-111111111203";

async function setup(raw: Record<string, string> = {}) {
  const config: Env = parseEnv({ NODE_ENV: "test", DEVICE_API_KEY: KEY, WARNING_ALERTS_ENABLED: "true", ...raw });
  const store = createMemoryStore();
  const app = await buildApp({ store, config, verifier });
  return { app, store };
}
const sos = (eventId: string) => ({ eventId, deviceId: "guardian-001", eventType: "SOS" });
const reading = (n: number, extra: object = {}) => ({ readingId: `r-${n}`, deviceId: "guardian-001", heartRateBpm: 80, signalQuality: "good", ...extra });

test("nurse routes require a valid token (401)", async () => {
  const { app } = await setup();
  for (const url of ["/api/alerts", "/api/patients", `/api/patients/${PATIENT_C}/readings`]) {
    assert.equal((await app.inject({ method: "GET", url })).statusCode, 401, url);
    assert.equal((await app.inject({ method: "GET", url, headers: { authorization: "Bearer bad" } })).statusCode, 401, url);
    assert.equal((await app.inject({ method: "GET", url, headers: nurse })).statusCode, 200, url);
  }
  // device key does not grant nurse access
  assert.equal((await app.inject({ method: "GET", url: "/api/alerts", headers: dev })).statusCode, 401);
  await app.close();
});

test("acknowledge: auth, 400, 404, user from token, idempotent, never reopens", async () => {
  const { app } = await setup();
  const created = (await app.inject({ method: "POST", url: "/api/devices/events", headers: dev, payload: sos("e1") })).json().alert;
  const url = `/api/alerts/${created.id}/acknowledge`;

  assert.equal((await app.inject({ method: "PATCH", url })).statusCode, 401);
  assert.equal((await app.inject({ method: "PATCH", url: "/api/alerts/not-a-uuid/acknowledge", headers: nurse })).statusCode, 400);
  assert.equal((await app.inject({ method: "PATCH", url: "/api/alerts/99999999-9999-4999-8999-999999999999/acknowledge", headers: nurse })).statusCode, 404);

  // body tries to impersonate another user: ignored
  const first = await app.inject({ method: "PATCH", url, headers: nurse, payload: { acknowledgedBy: "someone-else" } });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().status, "acknowledged");
  assert.equal(first.json().acknowledgedBy, NURSE_A);
  const stamp = first.json().acknowledgedAt;

  const again = await app.inject({ method: "PATCH", url, headers: nurse, payload: {} });
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().acknowledgedAt, stamp);

  // retrying the SOS does not reopen it
  const retry = await app.inject({ method: "POST", url: "/api/devices/events", headers: dev, payload: sos("e1") });
  assert.equal(retry.json().alert.status, "acknowledged");
  assert.equal((await app.inject({ method: "GET", url: "/api/alerts?status=open", headers: nurse })).json().length, 0);
  await app.close();
});

test("readings: auth, validation, idempotency, nulls preserved, latestReading", async () => {
  const { app } = await setup();
  const post = (payload: object, headers = dev) => app.inject({ method: "POST", url: "/api/devices/readings", headers, payload });

  assert.equal((await post(reading(1), {} as never)).statusCode, 401);
  for (const bad of [reading(1, { heartRateBpm: 0 }), reading(1, { heartRateBpm: 400 }), reading(1, { skinTemperatureC: 99 }), reading(1, { signalQuality: "great" }), reading(1, { accelerationG: { x: 1, y: "a", z: 0 } }), reading(1, { deviceId: "x" })]) {
    assert.ok([400, 403].includes((await post(bad)).statusCode), JSON.stringify(bad));
  }

  const a = await post(reading(1));
  const b = await post(reading(1));
  assert.equal(a.statusCode, 201);
  assert.equal(b.statusCode, 200);
  assert.equal(a.json().reading.id, b.json().reading.id);

  const nul = await post({ readingId: "r-null", deviceId: "guardian-001", heartRateBpm: null });
  assert.equal(nul.statusCode, 201);
  assert.equal(nul.json().reading.heartRateBpm, null);
  assert.equal(nul.json().reading.skinTemperatureC, null);
  assert.equal(nul.json().reading.signalQuality, "unknown");

  const list = await app.inject({ method: "GET", url: `/api/patients/${PATIENT_C}/readings?limit=1`, headers: nurse });
  assert.equal(list.json().length, 1);
  assert.equal((await app.inject({ method: "GET", url: "/api/patients/11111111-1111-4111-8111-111111111999/readings", headers: nurse })).statusCode, 404);

  const pts = (await app.inject({ method: "GET", url: "/api/patients", headers: nurse })).json();
  assert.ok(pts.find((p: { room: string }) => p.room === "203").latestReading);
  assert.equal(pts.find((p: { room: string }) => p.room === "201").latestReading, null);
  await app.close();
});

test("a single spike via the API never creates an alert", async () => {
  const { app } = await setup();
  await app.inject({ method: "POST", url: "/api/devices/readings", headers: dev, payload: reading(1, { heartRateBpm: 200 }) });
  const alerts = (await app.inject({ method: "GET", url: "/api/alerts", headers: nurse })).json();
  assert.equal(alerts.length, 0);
  await app.close();
});

test("sustained high HR via the API makes a labelled simulation alert (zero duration for test)", async () => {
  const { app } = await setup({ ALLOW_SIMULATED_DATA: "true", DEMO_HR_DURATION_SECONDS: "1", DEMO_HR_MIN_SAMPLES: "2" });
  const post = (n: number) => app.inject({ method: "POST", url: "/api/devices/readings", headers: dev, payload: reading(n, { heartRateBpm: 150, source: "simulation" }) });
  await post(1);
  await new Promise((r) => setTimeout(r, 1100));
  await post(2);
  const alerts = (await app.inject({ method: "GET", url: "/api/alerts", headers: nurse })).json();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, "HEART_RATE_ALERT");
  assert.equal(alerts[0].detail, "HR_HIGH");
  assert.equal(alerts[0].source, "simulation");
  assert.equal(alerts[0].eventId, null);
  await app.close();
});

// ---- engine unit tests (pure, no clock) ----
const rule: HrRule = { lowBpm: 50, highBpm: 120, durationMs: 10_000, minSamples: 3, cooldownMs: 60_000 };
const S = (t: number, hr: number | null, quality: "good" | "poor" | "unknown" = "good", fresh = true) => ({ atMs: t * 1000, heartRateBpm: hr, quality, fresh });

test("engine: single spike and too-short streak do not alert", () => {
  const e = new HrEngine(rule);
  assert.equal(e.ingest("d", S(0, 180)), null);
  assert.equal(e.ingest("d", S(1, 80)), null);
  assert.equal(e.ingest("d", S(2, 180)), null);
  assert.equal(e.ingest("d", S(3, 180)), null);
  assert.equal(e.ingest("d", S(4, 180)), null); // 3 samples but only 2s span
});

test("engine: sustained high alerts once, cooldown suppresses, then re-alerts", () => {
  const e = new HrEngine(rule);
  assert.equal(e.ingest("d", S(0, 130)), null);
  assert.equal(e.ingest("d", S(5, 130)), null);
  assert.equal(e.ingest("d", S(10, 130)), "HR_HIGH");
  for (const t of [11, 15, 20, 25]) assert.equal(e.ingest("d", S(t, 130)), null, `t=${t}`);
  assert.equal(e.ingest("d", S(60, 130)), null);
  assert.equal(e.ingest("d", S(65, 130)), null);
  assert.equal(e.ingest("d", S(71, 130)), "HR_HIGH");
});

test("engine: low side works; poor/unknown/null/stale samples reset the streak", () => {
  const e = new HrEngine(rule);
  e.ingest("d", S(0, 40));
  e.ingest("d", S(5, 40));
  assert.equal(e.ingest("d", S(8, 40, "poor")), null); // reset
  assert.equal(e.ingest("d", S(10, 40)), null);
  assert.equal(e.ingest("d", S(15, 40)), null);
  assert.equal(e.ingest("d", S(20, 40)), "HR_LOW");

  const f = new HrEngine(rule);
  f.ingest("d", S(0, 130));
  f.ingest("d", S(5, 130));
  assert.equal(f.ingest("d", S(10, null)), null);
  assert.equal(f.ingest("d", S(11, 130, "good", false)), null);
  assert.equal(f.ingest("d", S(12, 130, "unknown")), null);
  assert.equal(f.ingest("d", S(15, 130)), null); // streak restarted
});
