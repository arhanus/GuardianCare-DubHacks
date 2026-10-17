import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

try {
  // 0.0.0.0 required so Render (and LAN devices) can reach the server.
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
