import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import { requireNurse } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { alertsQuerySchema } from "../schemas/alerts.js";
import { z } from "zod";
import { alertParam } from "../schemas/readings.js";
import type { LiveHub } from "../services/live-hub.js";
import type { NurseVerifier } from "../services/nurse-auth.js";
import type { Store } from "../services/store.js";

interface Deps {
  store: Store;
  config: Env;
  verifier: NurseVerifier;
  hub: LiveHub;
}

/** Local-dev stand-in for the acknowledging nurse when REQUIRE_NURSE_AUTH=false (never in production). */
export const DEMO_NURSE_ID = "00000000-0000-4000-8000-000000000001";

const resolveBody = z.object({ note: z.string().trim().min(1).max(500) });

export async function alertRoutes(app: FastifyInstance, { store, config, verifier, hub }: Deps) {
  app.get("/api/alerts", async (req) => {
    if (config.REQUIRE_NURSE_AUTH) await requireNurse(req, verifier);
    const { status, limit } = alertsQuerySchema.parse(req.query);
    return store.listAlerts({ status, limit });
  });

  // acknowledgedBy is always the authenticated user; any body is ignored.
  app.patch("/api/alerts/:alertId/acknowledge", async (req) => {
    const user = config.REQUIRE_NURSE_AUTH || config.NODE_ENV === "production"
      ? await requireNurse(req, verifier)
      : await requireNurse(req, verifier).catch(() => ({ id: DEMO_NURSE_ID }));
    const { alertId } = alertParam.parse(req.params);
    const result = await store.acknowledgeAlert(alertId, user.id);
    if (!result) throw new AppError(404, "not_found", "Alert not found");
    app.log.info({ alertId, changed: result.changed }, "alert acknowledge");
    if (result.changed) hub.publish({ type: "alert_updated", alert: result.alert });
    // Idempotent: repeated acknowledgement returns the existing record (200). Never re-opens.
    return result.alert;
  });

  // Closes an event with a caregiver's note. resolvedBy is always the authenticated user.
  app.patch("/api/alerts/:alertId/resolve", async (req) => {
    const user = config.REQUIRE_NURSE_AUTH || config.NODE_ENV === "production"
      ? await requireNurse(req, verifier)
      : await requireNurse(req, verifier).catch(() => ({ id: DEMO_NURSE_ID }));
    const { alertId } = alertParam.parse(req.params);
    const { note } = resolveBody.parse(req.body);
    const result = await store.resolveAlert(alertId, user.id, note);
    if (!result) throw new AppError(404, "not_found", "Alert not found");
    app.log.info({ alertId, changed: result.changed }, "alert resolve");
    if (result.changed) hub.publish({ type: "alert_updated", alert: result.alert });
    return result.alert;
  });
}
