/**
 * Sends a SIMULATED SOS (source="simulation") to a running API. Not a real sensor event.
 * The API must run with ALLOW_SIMULATED_DATA=true and NODE_ENV!=production.
 *   DEVICE_API_KEY=... npm run simulate:sos -w @guardiancare/api -- [baseUrl]
 */
const base = process.argv[2] ?? "http://localhost:3000";
const key = process.env.DEVICE_API_KEY ?? "";
const deviceId = process.env.DEVICE_ID ?? "guardian-001";
if (!key) {
  console.error("Set DEVICE_API_KEY in your environment.");
  process.exit(1);
}
const res = await fetch(`${base}/api/devices/events`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-device-key": key },
  body: JSON.stringify({ eventId: `${deviceId}-sim-${Date.now()}`, deviceId, eventType: "SOS", source: "simulation" }),
});
console.log(res.status, await res.text());
