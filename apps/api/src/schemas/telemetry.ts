import { z } from "zod";

const num = z.number().finite();
const numOrNull = num.nullish();

/**
 * Snapshot POSTed once per second by the ESP32 firmware (hardware/esp32). Lenient on purpose:
 * unknown fields are ignored and sensor values may be null, so one bad sensor never rejects the rest.
 */
export const telemetrySchema = z.object({
  deviceId: z.string().min(1).max(64),
  firmware: z.string().max(32).optional(),
  seq: z.number().int().nonnegative().optional(),
  uptimeMs: z.number().int().nonnegative().optional(),
  heart: z
    .object({
      valid: z.boolean(),
      bpm: numOrNull,
      status: z.string().max(32).optional(),
    })
    .optional(),
  temperature: z.object({ valid: z.boolean(), celsius: numOrNull }).optional(),
  imu: z
    .object({
      valid: z.boolean(),
      motionDetected: z.boolean().optional(),
      accel: z.object({ x: num, y: num, z: num }).nullish(),
      gyro: z.object({ x: num, y: num, z: num }).nullish(),
      // Largest values seen since the previous snapshot (impacts between 1 s samples).
      peak: z
        .object({ accelG: numOrNull, jerkG: numOrNull, gyroDps: numOrNull })
        .nullish(),
    })
    .optional(),
  device: z.object({ wifiRssi: z.number().optional() }).passthrough().optional(),
});
export type Telemetry = z.infer<typeof telemetrySchema>;
