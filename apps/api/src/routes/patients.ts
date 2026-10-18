import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import { requireNurse } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { z } from "zod";
import { readingsQuerySchema, uuidParam } from "../schemas/readings.js";
import type { LiveHub } from "../services/live-hub.js";
import type { NurseVerifier } from "../services/nurse-auth.js";
import type { Reading, Store } from "../services/store.js";

export function isOnline(lastSeenAt: string | null, timeoutSeconds: number, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const age = now - Date.parse(lastSeenAt);
  return age >= 0 ? age < timeoutSeconds * 1000 : true;
}

/** Reading plus repo-contract alias fields (timestamp, motionG, temperatureC). */
export function withAliases(r: Reading) {
  const a = r.accelerationG;
  return {
    ...r,
    timestamp: r.receivedAt,
    temperatureC: r.skinTemperatureC,
    motionG: a ? Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) : null,
  };
}

interface Deps {
  store: Store;
  config: Env;
  verifier: NurseVerifier;
  hub: LiveHub;
}

const appSosSchema = z.object({ eventId: z.string().min(1).max(128) });

export async function patientRoutes(app: FastifyInstance, { store, config, verifier, hub }: Deps) {
  const guard = async (req: Parameters<typeof requireNurse>[0]) => {
    if (config.REQUIRE_NURSE_AUTH) await requireNurse(req, verifier);
  };

  app.get("/api/patients", async (req) => {
    await guard(req);
    const [patients, counts] = await Promise.all([store.listPatients(), store.countOpenAlertsByPatient()]);
    const latest = await store.latestReadings(patients.map((p) => p.id));
    // Repo contract fields (id, displayName, room, deviceId) plus additive fields. Online status is
    // derived from last_seen_at at request time, never stored.
    return patients.map((p) => {
      const lr = latest[p.id];
      return {
        id: p.id,
        displayName: p.displayName,
        room: p.roomNumber,
        deviceId: p.device?.id ?? null,
        roomNumber: p.roomNumber,
        device: p.device
          ? {
              id: p.device.id,
              lastSeenAt: p.device.lastSeenAt,
              isOnline: isOnline(p.device.lastSeenAt, config.DEVICE_ONLINE_TIMEOUT_SECONDS),
            }
          : null,
        latestReading: lr ? withAliases(lr) : null,
        activeAlertCount: counts[p.id] ?? 0,
      };
    });
  });

  app.get("/api/patients/:patientId/readings", async (req) => {
    await guard(req);
    const { patientId } = uuidParam.parse(req.params);
    const { limit } = readingsQuerySchema.parse(req.query);
    if (!(await store.patientExists(patientId))) throw new AppError(404, "not_found", "Patient not found");
    return (await store.listReadings(patientId, limit)).map(withAliases);
  });

  /**
   * SOS pressed in the app. eventId is client-generated so retries are idempotent. Uses the same
   * guard as the other nurse routes (open when REQUIRE_NURSE_AUTH=false, demo only).
   */
  app.post("/api/patients/:patientId/sos", async (req, reply) => {
    await guard(req);
    const { patientId } = uuidParam.parse(req.params);
    const { eventId } = appSosSchema.parse(req.body);
    const patient = (await store.listPatients()).find((p) => p.id === patientId);
    if (!patient) throw new AppError(404, "not_found", "Patient not found");
    if (!patient.device) throw new AppError(409, "device_unassigned", "Patient has no assigned device");

    const { alert, created } = await store.createSosAlert({
      patientId,
      deviceId: patient.device.id,
      eventId,
      source: "app",
    });
    if (alert.patientId !== patientId) throw new AppError(409, "event_id_conflict", "eventId already used");
    if (created) hub.publish({ type: "alert", alert });
    app.log.info({ alertId: alert.id, created }, "app SOS processed");
    return reply.status(created ? 201 : 200).send({ alert, duplicate: !created });
  });
}
