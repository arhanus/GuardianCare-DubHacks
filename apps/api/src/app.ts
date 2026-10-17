import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  // Mobile native clients don't need CORS; kept open for Expo web/dev tools. Tighten before real use.
  await app.register(cors, { origin: true });

  await app.register(healthRoutes);

  return app;
}
