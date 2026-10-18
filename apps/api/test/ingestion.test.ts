import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { parseEnv, type Env } from "../src/config/env.js";
import { createMemoryStore } from "../src/services/memory-store.js";

const KEY = "test-device-key";
const config: Env = parseEnv({ NODE_ENV: "test", DEVICE_API_KEY: KEY, REQUIRE_NURSE_AUTH: "false", WARNING_ALERTS_ENABLED: "true" });

async function setup(overrides: Partial<Env> = {}) {
  const store = createMemoryStore();
  const app = await buildApp({ store, config: { ...config, ...overrides } });
  return { app, store };
}
const auth = { "x-device-key": KEY };
const sos = (eventId: string, extra: object = {}) => ({
  eventId,
  deviceId: "guardian-001",
  eventType: "SOS",
  ...extra,
});

test("rejects missing and wrong device key with 401", async () => {
  const { app } = await setup();
  for (const headers of [{}, { "x-device-key": "nope" }, { authorization: "Bearer nope" }]) {
    const res = await app.inject({ method: "POST", url: "/api/devices/events", headers, payload: sos("e1") });
    assert.equal(res.statusCode, 401);
  }
  await app.close();
});

test("unset DEVICE_API_KEY rejects everything, even an empty key", async () => {
  const { app } = await setup({ DEVICE_API_KEY: "" });
  const res = await app.inject({ method: "POST", url: "/api/devices/events", headers: { "x-device-key": "" }, payload: sos("e1") });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("accepts Bearer auth as well", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "POST", url: "/api/devices/heartbeat", headers: { authorization: `Bearer ${KEY}` }, payload: { deviceId: "guardian-001" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("mismatched deviceId returns 403", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: { ...sos("e1"), deviceId: "guardian-999" } });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("bad input returns 400", async () => {
  const { app } = await setup();
  for (const payload of [{}, { eventId: "", deviceId: "guardian-001", eventType: "SOS" }, sos("e1", { eventType: "FIRE" }), sos("e1", { timestamp: "yesterday" })]) {
    const res = await app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload });
    assert.equal(res.statusCode, 400, JSON.stringify(payload));
  }
  await app.close();
});

test("SOS creates one alert for Room 203 from server-side mapping; retry returns the same one", async () => {
  const { app } = await setup();
  // patientId in the body must be ignored
  const body = sos("evt-1", { patientId: "11111111-1111-4111-8111-111111111201", occurredAt: null });
  const a = await app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: body });
  const b = await app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: body });
  assert.equal(a.statusCode, 202);
  assert.equal(a.json().duplicate, false);
  assert.equal(b.json().duplicate, true);
  assert.equal(a.json().alert.id, b.json().alert.id);
  assert.equal(a.json().alert.patientId, "11111111-1111-4111-8111-111111111203");
  assert.equal(a.json().alert.source, "device");
  const list = await app.inject({ method: "GET", url: "/api/alerts" });
  assert.equal(list.json().length, 1);
  await app.close();
});

test("same eventId sent concurrently yields exactly one alert", async () => {
  const { app } = await setup();
  const results = await Promise.all(
    Array.from({ length: 10 }, () => app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: sos("evt-race") })),
  );
  assert.equal(new Set(results.map((r) => r.json().alert.id)).size, 1);
  assert.equal(results.filter((r) => r.json().duplicate === false).length, 1);
  const list = await app.inject({ method: "GET", url: "/api/alerts?status=open" });
  assert.equal(list.json().length, 1);
  await app.close();
});

test("simulation source is refused unless enabled, and labelled when enabled", async () => {
  const off = await setup();
  const r1 = await off.app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: sos("s1", { source: "simulation" }) });
  assert.equal(r1.statusCode, 403);
  await off.app.close();

  const on = await setup({ ALLOW_SIMULATED_DATA: true });
  const r2 = await on.app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: sos("s1", { source: "simulation" }) });
  assert.equal(r2.statusCode, 202);
  assert.equal(r2.json().alert.source, "simulation");
  await on.app.close();
});

test("HEARTBEAT event updates last seen; unsupported eventType is 400", async () => {
  const { app } = await setup();
  const hb = await app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: sos("h1", { eventType: "HEARTBEAT" }) });
  assert.equal(hb.statusCode, 202);
  const hr = await app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: sos("h2", { eventType: "HEART_RATE_ALERT" }) });
  assert.equal(hr.statusCode, 400);
  await app.close();
});

test("patients: offline before heartbeat, online after, alert count reflected", async () => {
  const { app, store } = await setup();
  const room = async () => (await app.inject({ method: "GET", url: "/api/patients" })).json().find((p: { room: string }) => p.room === "203");

  let p = await room();
  assert.equal(p.device.isOnline, false);
  assert.equal(p.device.lastSeenAt, null);
  assert.equal(p.latestReading, null);

  await app.inject({ method: "POST", url: "/api/devices/heartbeat", headers: auth, payload: { deviceId: "guardian-001" } });
  await app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: sos("p1") });
  p = await room();
  assert.equal(p.device.isOnline, true);
  assert.equal(p.activeAlertCount, 1);
  assert.equal(p.displayName, "Eleanor Brooks");

  // stale: last seen 2 minutes ago -> offline
  await store.touchDevice("guardian-001", new Date(Date.now() - 120_000));
  assert.equal((await room()).device.isOnline, false);
  await app.close();
});

test("alerts status filter and validation", async () => {
  const { app } = await setup();
  await app.inject({ method: "POST", url: "/api/devices/events", headers: auth, payload: sos("f1") });
  assert.equal((await app.inject({ method: "GET", url: "/api/alerts?status=active" })).json().length, 1);
  assert.equal((await app.inject({ method: "GET", url: "/api/alerts?status=acknowledged" })).json().length, 0);
  assert.equal((await app.inject({ method: "GET", url: "/api/alerts?status=bogus" })).statusCode, 400);
  await app.close();
});
