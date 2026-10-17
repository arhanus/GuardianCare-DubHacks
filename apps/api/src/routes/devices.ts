import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import { requireDeviceKey } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { deviceEventSchema, heartbeatSchema } from "../schemas/devices.js";
import { readingSchema } from "../schemas/readings.js";
import type { HrEngine } from "../services/hr-engine.js";
import type { Store } from "../services/store.js";

interface Deps {
  store: Store;
  config: Env;
  engine: HrEngine;
}

export async function deviceRoutes(app: FastifyInstance, { store, config, engine }: Deps) {
  /** Authenticated device must be the one configured; body deviceId must match and be registered. */
  async function resolveDevice(deviceId: string) {
    if (deviceId !== config.DEVICE_ID) {
      throw new AppError(403, "forbidden", "Device key is not valid for this deviceId");
    }
    const device = await store.getDevice(deviceId);
    if (!device) throw new AppError(404, "unknown_device", "Unknown device");
    return device;
  }

  function resolveSource(requested: "device" | "simulation" | undefined): "device" | "simulation" {
    if (requested !== "simulation") return "device";
    if (!config.ALLOW_SIMULATED_DATA || config.NODE_ENV === "production") {
      throw new AppError(403, "simulation_disabled", "Simulated data is not enabled");
    }
    return "simulation";
  }

  async function touch(deviceId: string) {
    try {
      await store.touchDevice(deviceId, new Date());
    } catch (err) {
      // Liveness bookkeeping must never block an SOS.
      app.log.error({ err, deviceId }, "failed to update last_seen_at");
    }
  }

  app.post("/api/devices/heartbeat", async (req, reply) => {
    requireDeviceKey(req, config.DEVICE_API_KEY);
    const { deviceId } = heartbeatSchema.parse(req.body);
    await resolveDevice(deviceId);
    await touch(deviceId);
    return reply.send({ ok: true, serverTime: new Date().toISOString() });
  });

  app.post("/api/devices/events", async (req, reply) => {
    requireDeviceKey(req, config.DEVICE_API_KEY);
    const body = deviceEventSchema.parse(req.body);
    const device = await resolveDevice(body.deviceId);

    if (body.eventType === "HEARTBEAT") {
      await touch(device.id);
      return reply.status(202).send({ accepted: true });
    }
    if (body.eventType !== "SOS") {
      throw new AppError(400, "unsupported_event", "Only SOS and HEARTBEAT events are accepted from devices");
    }
    if (!device.patientId) throw new AppError(409, "device_unassigned", "Device is not assigned to a patient");

    const source = resolveSource(body.source);

    // patientId always comes from the server-side device assignment, never from the request.
    const { alert, created } = await store.createSosAlert({
      patientId: device.patientId,
      deviceId: device.id,
      eventId: body.eventId,
      source,
    });
    if (alert.deviceId !== device.id) {
      throw new AppError(409, "event_id_conflict", "eventId already used by another device");
    }
    await touch(device.id);

    app.log.info({ eventId: alert.eventId, alertId: alert.id, created, source }, "SOS event processed");
    // 202 per repo contract (also for duplicates); `alert` is an additive field.
    return reply.status(202).send({ accepted: true, duplicate: !created, alert });
  });

  app.post("/api/devices/readings", async (req, reply) => {
    requireDeviceKey(req, config.DEVICE_API_KEY);
    const body = readingSchema.parse(req.body);
    const device = await resolveDevice(body.deviceId);
    if (!device.patientId) throw new AppError(409, "device_unassigned", "Device is not assigned to a patient");
    const source = resolveSource(body.source);

    const observedAt = body.observedAt ?? body.timestamp ?? null;
    const { reading, created } = await store.insertReading({
      readingId: body.readingId,
      deviceId: device.id,
      patientId: device.patientId,
      heartRateBpm: body.heartRateBpm ?? null,
      skinTemperatureC: body.skinTemperatureC ?? null,
      accelerationG: body.accelerationG ?? null,
      signalQuality: body.signalQuality,
      source,
      observedAt,
    });
    if (reading.deviceId !== device.id) {
      throw new AppError(409, "reading_id_conflict", "readingId already used by another device");
    }
    await touch(device.id);

    // Duplicates (retries) never feed the alert engine.
    if (created) {
      const receivedMs = Date.parse(reading.receivedAt);
      const skewMs = config.READING_MAX_SKEW_SECONDS * 1000;
      const fresh = observedAt === null || Math.abs(receivedMs - Date.parse(observedAt)) <= skewMs;
      const detail = engine.ingest(device.id, {
        atMs: receivedMs,
        heartRateBpm: reading.heartRateBpm,
        quality: reading.signalQuality,
        fresh,
      });
      if (detail) {
        const alert = await store.createHrAlert({ patientId: device.patientId, deviceId: device.id, detail, source });
        app.log.info({ alertId: alert.id, detail, source }, "demo HR threshold alert created");
      }
    }
    return reply.status(created ? 201 : 200).send({ reading });
  });
}
