import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { parseEnv } from "../src/config/env.js";
import { createMemoryStore } from "../src/services/memory-store.js";
import { PushService, alertTitle } from "../src/services/push.js";

const config = parseEnv({ NODE_ENV: "test", DEVICE_API_KEY: "k", REQUIRE_NURSE_AUTH: "false" });
const TOKEN = "ExponentPushToken[abc123_DEF-456]";
const PATIENT = "11111111-1111-4111-8111-111111111203";
const silent = { error() {}, info() {} };

test("push token routes: register, reject junk, delete", async () => {
  const store = createMemoryStore();
  const app = await buildApp({ store, config });
  const reg = await app.inject({ method: "POST", url: "/api/push-tokens", payload: { token: TOKEN } });
  assert.equal(reg.statusCode, 204);
  assert.deepEqual(await store.listPushTokens(), [TOKEN]);
  await app.inject({ method: "POST", url: "/api/push-tokens", payload: { token: TOKEN } }); // idempotent
  assert.equal((await store.listPushTokens()).length, 1);
  const bad = await app.inject({ method: "POST", url: "/api/push-tokens", payload: { token: "not-a-token" } });
  assert.equal(bad.statusCode, 400);
  const del = await app.inject({ method: "DELETE", url: "/api/push-tokens", payload: { token: TOKEN } });
  assert.equal(del.statusCode, 204);
  assert.deepEqual(await store.listPushTokens(), []);
});

test("PushService sends one message per token with resident, room and deep link", async () => {
  const store = createMemoryStore();
  await store.savePushToken(TOKEN);
  const calls: { url: string; body: { to: string; title: string; body: string; priority: string; data: { url: string } }[] }[] = [];
  const fakeFetch = (async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ data: [{ status: "ok" }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const alert = await store.createSensorAlert({ patientId: PATIENT, deviceId: "guardian-001", type: "MOTION_ALERT", detail: "FALL", severity: "urgent", source: "device" });
  await new PushService(store, silent, fakeFetch).notifyAlert(alert);
  assert.equal(calls.length, 1);
  const [m] = calls[0]!.body;
  assert.equal(m!.to, TOKEN);
  assert.match(m!.title, /Possible fall/);
  assert.equal(m!.priority, "high");
  assert.equal(m!.data.url, `/incident/${alert.id}`);
  assert.match(m!.body, /room/);
});

test("PushService forgets tokens Expo reports as DeviceNotRegistered, and never throws", async () => {
  const store = createMemoryStore();
  await store.savePushToken(TOKEN);
  const alert = await store.createSensorAlert({ patientId: PATIENT, deviceId: "guardian-001", type: "MOTION_ALERT", detail: "FALL", severity: "urgent", source: "device" });
  const gone = (async () => new Response(JSON.stringify({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }), { status: 200 })) as unknown as typeof fetch;
  await new PushService(store, silent, gone).notifyAlert(alert);
  assert.deepEqual(await store.listPushTokens(), []);
  await store.savePushToken(TOKEN);
  const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  await new PushService(store, silent, down).notifyAlert(alert); // must resolve
  assert.deepEqual(await store.listPushTokens(), [TOKEN]);
});

test("alertTitle names the event", () => {
  assert.equal(alertTitle({ type: "SOS", detail: null }), "SOS pressed");
  assert.equal(alertTitle({ type: "HEART_RATE_ALERT", detail: "HR_HIGH" }), "High heart rate");
});
