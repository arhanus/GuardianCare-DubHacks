import { z } from "zod";

const finite = z.number().finite().min(-100).max(100);
const isoOrNull = z.iso.datetime({ offset: true }).nullish();

export const readingSchema = z.object({
  readingId: z.string().min(1).max(128),
  deviceId: z.string().min(1).max(64),
  // null/absent = unavailable. 0 is NOT a valid substitute; bounds reject it.
  heartRateBpm: z.number().int().min(20).max(250).nullish(),
  skinTemperatureC: z.number().finite().min(20).max(45).nullish(),
  accelerationG: z.object({ x: finite, y: finite, z: finite }).nullish(),
  signalQuality: z.enum(["good", "poor", "unknown"]).default("unknown"),
  observedAt: isoOrNull,
  timestamp: isoOrNull, // alias used by the repo contract
  source: z.enum(["device", "simulation"]).optional(),
});

export const readingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidParam = z.object({ patientId: z.uuid() });
export const alertParam = z.object({ alertId: z.uuid() });
