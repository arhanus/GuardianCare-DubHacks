import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import { requireDeviceKey } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { deviceEventSchema, heartbeatSchema } from "../schemas/devices.js";
import { readingSchema } from "../schemas/readings.js";
import { telemetrySchema } from "../schemas/telemetry.js";
import type { HrEngine } from "../services/hr-engine.js";
import type { LiveHub } from "../services/live-hub.js";
import type { MotionEngine } from "../services/motion-engine.js";
import type { ThresholdEngine } from "../services/threshold-engine.js";
import type { Alert, DeviceRow, NewReading, Source, Store } from "../services/store.js";
import { withAliases } from "./patients.js";

export interface Engines {
  hr: HrEngine;
  temp: ThresholdEngine;
  motion: MotionEngine;
}

interface Deps {
  store: Store;
  config: Env;
  engines: Engines;
  hub: LiveHub;
}

export async function deviceRoutes(app: FastifyInstance, { store, config, engines, hub }: Deps) {
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

  /**
   * Creates a sensor alert and pushes it to phones. A storage failure (e.g. a migration not applied)
   * is logged loudly but must not make the wristband's POST fail.
   */
  async function raise(alert: Promise<Alert>): Promise<Alert | null> {
    try {
      const created = await alert;
      hub.publish({ type: "alert", alert: created });
      return created;
    } catch (err) {
      app.log.error({ err }, "FAILED to create sensor alert (is supabase/migrations/20261017000400_sensor_alerts.sql applied?)");
      return null;
    }
  }

  /**
   * Shared by /readings and /telemetry: store, mark device alive, push to phones, run alarm rules.
   * Duplicates (retries) never feed the alert engines.
   */
  async function processReading(
    device: DeviceRow & { patientId: string },
    input: Omit<NewReading, "deviceId" | "patientId">,
    peak: { accelG?: number | null; jerkG?: number | null } | null,
  ) {
    const { reading, created } = await store.insertReading({ ...input, deviceId: device.id, patientId: device.patientId });
    if (reading.deviceId !== device.id) {
      throw new AppError(409, "reading_id_conflict", "readingId already used by another device");
    }
    await touch(device.id);
    if (!created) return { reading, created };

    hub.publish({ type: "reading", patientId: device.patientId, reading: withAliases(reading) });

    const receivedMs = Date.parse(reading.receivedAt);
    const skewMs = config.READING_MAX_SKEW_SECONDS * 1000;
    const observedAt = input.observedAt;
    const fresh = observedAt === null || Math.abs(receivedMs - Date.parse(observedAt)) <= skewMs;
    const base = { patientId: device.patientId, deviceId: device.id, source: input.source as Source };

    const hr = engines.hr.ingest(device.id, {
      atMs: receivedMs,
      heartRateBpm: reading.heartRateBpm,
      quality: reading.signalQuality,
      fresh,
    });
    if (hr) {
      const alert = await raise(store.createSensorAlert({ ...base, type: "HEART_RATE_ALERT", detail: hr }));
      if (alert) app.log.info({ alertId: alert.id, detail: hr }, "demo HR threshold alert created");
    }

    if (fresh) {
      const temp = engines.temp.ingest(device.id, receivedMs, reading.skinTemperatureC);
      if (temp) {
        const detail = temp === "HIGH" ? "TEMP_HIGH" : "TEMP_LOW";
        const alert = await raise(store.createSensorAlert({ ...base, type: "TEMPERATURE_ALERT", detail }));
        if (alert) app.log.info({ alertId: alert.id, detail }, "demo temperature alert created");
      }
      const moved = engines.motion.ingest(device.id, {
        atMs: receivedMs,
        accel: reading.accelerationG,
        peakAccelG: peak?.accelG,
        peakJerkG: peak?.jerkG,
      });
      if (moved) {
        const alert = await raise(store.createSensorAlert({ ...base, type: "MOTION_ALERT", detail: "SUDDEN_MOTION" }));
        if (alert) app.log.info({ alertId: alert.id }, "demo sudden-motion alert created");
      }
    }
    return { reading, created };
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

    if (created) hub.publish({ type: "alert", alert });
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

    const { reading, created } = await processReading(
      { ...device, patientId: device.patientId },
      {
        readingId: body.readingId,
        heartRateBpm: body.heartRateBpm ?? null,
        skinTemperatureC: body.skinTemperatureC ?? null,
        accelerationG: body.accelerationG ?? null,
        signalQuality: body.signalQuality,
        source,
        observedAt: body.observedAt ?? body.timestamp ?? null,
      },
      null,
    );
    return reply.status(created ? 201 : 200).send({ reading });
  });

  /**
   * Firmware telemetry (hardware/esp32): nested JSON, once per second. Adapted to a stored reading;
   * out-of-range sensor values become null instead of rejecting the whole snapshot.
   */
  app.post("/api/telemetry", async (req, reply) => {
    requireDeviceKey(req, config.DEVICE_API_KEY);
    const t = telemetrySchema.parse(req.body);
    const device = await resolveDevice(t.deviceId);
    if (!device.patientId) throw new AppError(409, "device_unassigned", "Device is not assigned to a patient");

    const bpm = t.heart?.valid && t.heart.bpm != null ? Math.round(t.heart.bpm) : null;
    const heartRateBpm = bpm !== null && bpm >= 20 && bpm <= 250 ? bpm : null;
    const c = t.temperature?.valid ? t.temperature.celsius ?? null : null;
    const skinTemperatureC = c !== null && c >= 20 && c <= 45 ? c : null;
    const a = t.imu?.valid ? t.imu.accel ?? null : null;
    const accelerationG = a && [a.x, a.y, a.z].every((v) => Math.abs(v) <= 100) ? a : null;

    const { reading } = await processReading(
      { ...device, patientId: device.patientId },
      {
        // Server-generated: firmware `seq` restarts at 0 on every reboot, so it cannot be a unique key.
        readingId: `${device.id}-${Date.now()}-${t.seq ?? 0}-${randomUUID().slice(0, 8)}`,
        heartRateBpm,
        skinTemperatureC,
        accelerationG,
        signalQuality: t.heart?.valid ? "good" : "poor",
        source: "device",
        observedAt: null, // the wristband has no real-time clock; server time is authoritative
      },
      t.imu?.peak ?? null,
    );
    return reply.status(201).send({ ok: true, receivedAt: reading.receivedAt });
  });
}
