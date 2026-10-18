import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { requireNurse } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import type { NurseVerifier } from "../services/nurse-auth.js";
import { isExpoPushToken } from "../services/push.js";
import type { Store } from "../services/store.js";
import { DEMO_NURSE_ID } from "./alerts.js";

interface Deps {
  store: Store;
  config: Env;
  verifier: NurseVerifier;
}

const body = z.object({ token: z.string().trim().max(200).refine(isExpoPushToken, "Not an Expo push token") });

export async function pushRoutes(app: FastifyInstance, { store, config, verifier }: Deps) {
  async function caregiver(req: Parameters<typeof requireNurse>[0]) {
    return config.REQUIRE_NURSE_AUTH || config.NODE_ENV === "production"
      ? requireNurse(req, verifier)
      : requireNurse(req, verifier).catch(() => ({ id: DEMO_NURSE_ID }));
  }

  // Caregiver phones register here; every registered token gets every new alert.
  app.post("/api/push-tokens", async (req, reply) => {
    await caregiver(req);
    const parsed = body.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "invalid_token", "Body must be { token: <Expo push token> }");
    await store.savePushToken(parsed.data.token);
    return reply.status(204).send();
  });

  // Called when a caregiver signs out so a family phone on the same device stops receiving alarms.
  app.delete("/api/push-tokens", async (req, reply) => {
    await caregiver(req);
    const parsed = body.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "invalid_token", "Body must be { token: <Expo push token> }");
    await store.deletePushToken(parsed.data.token);
    return reply.status(204).send();
  });
}
