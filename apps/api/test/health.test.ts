import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

test("GET /api/health returns ok", async () => {
  const app = await buildApp();
  const res = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: "ok", service: "guardiancare-api" });
  await app.close();
});

test("unknown route returns 404 with error body", async () => {
  const app = await buildApp();
  const res = await app.inject({ method: "GET", url: "/api/nope" });
  assert.equal(res.statusCode, 404);
  assert.equal(typeof res.json().error, "string");
  await app.close();
});

test("malformed JSON returns 400, not 500", async () => {
  const app = await buildApp();
  app.post("/t", async () => ({ ok: true }));
  const res = await app.inject({
    method: "POST",
    url: "/t",
    headers: { "content-type": "application/json" },
    payload: "{bad",
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});
