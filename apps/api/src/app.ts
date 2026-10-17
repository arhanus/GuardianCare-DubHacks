import Fastify from "fastify";
import cors from "@fastify/cors";
import { env, type Env } from "./config/env.js";
import { registerErrorHandlers } from "./lib/errors.js";
import { alertRoutes } from "./routes/alerts.js";
import { deviceRoutes } from "./routes/devices.js";
import { healthRoutes } from "./routes/health.js";
import { patientRoutes } from "./routes/patients.js";
import { createStore } from "./services/supabase.js";
import { HrEngine } from "./services/hr-engine.js";
import { createNurseVerifier, type NurseVerifier } from "./services/nurse-auth.js";
import type { Store } from "./services/store.js";

export async function buildApp(opts: { store?: Store; config?: Env; verifier?: NurseVerifier } = {}) {
  const config = opts.config ?? env;
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : config.NODE_ENV === "test" ? "silent" : "debug",
      // Defense in depth: never write credentials to logs.
      redact: {
        paths: [
          "req.headers.authorization",
          'req.headers["x-device-key"]',
          'req.headers["apikey"]',
        ],
        censor: "[redacted]",
      },
    },
  });

  registerErrorHandlers(app);

  // Mobile native clients don't need CORS; kept open for Expo web/dev tools. Tighten before real use.
  await app.register(cors, { origin: true });

  const store = opts.store ?? createStore(config, app.log);
  await app.register(healthRoutes);
  const verifier = opts.verifier ?? createNurseVerifier(config, app.log);
  const engine = new HrEngine({
    lowBpm: config.DEMO_HR_LOW_BPM,
    highBpm: config.DEMO_HR_HIGH_BPM,
    durationMs: config.DEMO_HR_DURATION_SECONDS * 1000,
    minSamples: config.DEMO_HR_MIN_SAMPLES,
    cooldownMs: config.DEMO_HR_COOLDOWN_SECONDS * 1000,
  });
  await app.register(deviceRoutes, { store, config, engine });
  await app.register(alertRoutes, { store, config, verifier });
  await app.register(patientRoutes, { store, config, verifier });

  return app;
}
