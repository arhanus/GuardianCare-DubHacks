import Fastify from "fastify";
import cors from "@fastify/cors";
import { env, type Env } from "./config/env.js";
import { registerErrorHandlers } from "./lib/errors.js";
import { alertRoutes } from "./routes/alerts.js";
import { deviceRoutes } from "./routes/devices.js";
import { healthRoutes } from "./routes/health.js";
import { patientRoutes } from "./routes/patients.js";
import { createStore } from "./services/supabase.js";
import websocket from "@fastify/websocket";
import { liveRoutes } from "./routes/live.js";
import { HrEngine } from "./services/hr-engine.js";
import { LiveHub } from "./services/live-hub.js";
import { MotionEngine } from "./services/motion-engine.js";
import { ThresholdEngine } from "./services/threshold-engine.js";
import { createNurseVerifier, type NurseVerifier } from "./services/nurse-auth.js";
import type { Store } from "./services/store.js";

export async function buildApp(opts: { store?: Store; config?: Env; verifier?: NurseVerifier } = {}) {
  const config = opts.config ?? env;
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : config.NODE_ENV === "test" ? "silent" : "debug",
      // The WebSocket nurse token travels in ?token=, so never log query strings.
      serializers: {
        req(req) {
          return { method: req.method, url: req.url?.split("?")[0], host: req.host, remoteAddress: req.ip };
        },
      },
      // Defense in depth: never write credentials to logs.
      redact: {
        paths: [
          "req.headers.authorization",
          'req.headers["x-device-key"]',
          'req.headers["x-api-key"]',
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
  const hub = new LiveHub();
  const engines = {
    hr: new HrEngine({
      lowBpm: config.DEMO_HR_LOW_BPM,
      highBpm: config.DEMO_HR_HIGH_BPM,
      durationMs: config.DEMO_HR_DURATION_SECONDS * 1000,
      minSamples: config.DEMO_HR_MIN_SAMPLES,
      cooldownMs: config.DEMO_HR_COOLDOWN_SECONDS * 1000,
    }),
    temp: new ThresholdEngine({
      low: config.DEMO_TEMP_LOW_C,
      high: config.DEMO_TEMP_HIGH_C,
      durationMs: config.DEMO_TEMP_DURATION_SECONDS * 1000,
      minSamples: config.DEMO_TEMP_MIN_SAMPLES,
      cooldownMs: config.DEMO_TEMP_COOLDOWN_SECONDS * 1000,
    }),
    motion: new MotionEngine({
      axisDeltaG: config.MOTION_AXIS_DELTA_G,
      jerkG: config.MOTION_JERK_G,
      impactG: config.MOTION_IMPACT_G,
      cooldownMs: config.MOTION_COOLDOWN_SECONDS * 1000,
    }),
  };
  await app.register(websocket);
  await app.register(liveRoutes, { config, verifier, hub });
  await app.register(deviceRoutes, { store, config, engines, hub });
  await app.register(alertRoutes, { store, config, verifier, hub });
  await app.register(patientRoutes, { store, config, verifier, hub });

  return app;
}
