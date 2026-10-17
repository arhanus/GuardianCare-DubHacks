import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import { requireNurse } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { alertsQuerySchema } from "../schemas/alerts.js";
import { alertParam } from "../schemas/readings.js";
import type { NurseVerifier } from "../services/nurse-auth.js";
import type { Store } from "../services/store.js";

interface Deps {
  store: Store;
  config: Env;
  verifier: NurseVerifier;
}

export async function alertRoutes(app: FastifyInstance, { store, config, verifier }: Deps) {
  app.get("/api/alerts", async (req) => {
    if (config.REQUIRE_NURSE_AUTH) await requireNurse(req, verifier);
    const { status, limit } = alertsQuerySchema.parse(req.query);
    return store.listAlerts({ status, limit });
  });

  // acknowledgedBy is always the authenticated user; any body is ignored.
  app.patch("/api/alerts/:alertId/acknowledge", async (req) => {
    const user = await requireNurse(req, verifier);
    const { alertId } = alertParam.parse(req.params);
    const result = await store.acknowledgeAlert(alertId, user.id);
    if (!result) throw new AppError(404, "not_found", "Alert not found");
    app.log.info({ alertId, changed: result.changed }, "alert acknowledge");
    // Idempotent: repeated acknowledgement returns the existing record (200). Never re-opens.
    return result.alert;
  });
}
