import { z } from "zod";

const isoOrNull = z.iso.datetime({ offset: true }).nullish();

export const deviceEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  deviceId: z.string().min(1).max(64),
  eventType: z.enum(["SOS", "HEARTBEAT", "HEART_RATE_ALERT"]),
  // Repo contract says `timestamp`; sprint proposal says `occurredAt`. Both optional: ESP32 may lack NTP.
  timestamp: isoOrNull,
  occurredAt: isoOrNull,
  // Only honoured when ALLOW_SIMULATED_DATA=true outside production.
  source: z.enum(["device", "simulation"]).optional(),
});

export const heartbeatSchema = z.object({ deviceId: z.string().min(1).max(64) });
