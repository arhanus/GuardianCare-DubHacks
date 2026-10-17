import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { getLanAddress } from "./lib/network.js";

const app = await buildApp();

try {
  // 0.0.0.0 so an ESP32 / phone on the same hotspot (and Render later) can reach it over plain HTTP.
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

const lan = getLanAddress();
app.log.info(`Local:   http://localhost:${env.PORT}`);
app.log.info(lan ? `LAN:     http://${lan}:${env.PORT}  <- use this for ESP32 / phone` : "LAN:     no external IPv4 interface found");

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "shutting down");
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
