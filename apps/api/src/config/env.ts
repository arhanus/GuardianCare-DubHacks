import { z } from "zod";

// Secrets default to "" so the API boots without Supabase credentials (B0).
// Feature code must check for emptiness before using them.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_ANON_KEY: z.string().default(""),
  // Holds the legacy service_role JWT or the newer sb_secret_... key. Backend only.
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  DEVICE_ID: z.string().default("guardian-001"),
  DEVICE_API_KEY: z.string().default(""),
  ALLOW_SIMULATED_DATA: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DEVICE_ONLINE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
  // When "true", nurse GET routes require a valid Supabase user token. Acknowledge always does.
  REQUIRE_NURSE_AUTH: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // DEMO-ONLY example thresholds. Not clinical advice.
  // Heart rate, only while resting. Warning (yellow) and critical (red, rings).
  DEMO_HR_LOW_BPM: z.coerce.number().int().positive().default(50),
  DEMO_HR_HIGH_BPM: z.coerce.number().int().positive().default(120),
  DEMO_HR_DURATION_SECONDS: z.coerce.number().int().positive().default(20),
  DEMO_HR_CRITICAL_LOW_BPM: z.coerce.number().int().positive().default(45),
  DEMO_HR_CRITICAL_HIGH_BPM: z.coerce.number().int().positive().default(150),
  DEMO_HR_CRITICAL_DURATION_SECONDS: z.coerce.number().int().positive().default(15),
  DEMO_HR_MIN_SAMPLES: z.coerce.number().int().min(2).default(3),
  DEMO_HR_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  // DEMO-ONLY skin temperature range (Celsius) and sudden-motion thresholds (g). Not clinical.
  // Skin temperature: warning when it stays DELTA_C away from the wearer's own baseline.
  DEMO_TEMP_BASELINE_SAMPLES: z.coerce.number().int().positive().default(60),
  DEMO_TEMP_DELTA_C: z.coerce.number().positive().default(1),
  DEMO_TEMP_DURATION_SECONDS: z.coerce.number().int().positive().default(300),
  DEMO_TEMP_MIN_SAMPLES: z.coerce.number().int().min(2).default(3),
  DEMO_TEMP_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  MOTION_AXIS_DELTA_G: z.coerce.number().positive().default(0.6),
  MOTION_JERK_G: z.coerce.number().positive().default(3),
  // The wristband IMU runs at +-8 g, so an impact threshold above the old 2 g sensor limit is meaningful.
  MOTION_IMPACT_G: z.coerce.number().positive().default(3.5),
  MOTION_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(30),
  // Fall = impact + this long without movement (critical). Resting = this long without movement.
  // Wristband health (warnings): sensor not on skin / nothing received for this long.
  NOT_WORN_SECONDS: z.coerce.number().int().positive().default(120),
  OFFLINE_SECONDS: z.coerce.number().int().positive().default(120),
  FALL_STILL_SECONDS: z.coerce.number().int().positive().default(10),
  // Impact + stillness alone also matches waving a hand and then resting it. A fall also needs this many of:
  // impact+stillness (1), free fall before the impact (+1), gravity direction change (+1). Set 1 to alert on impact+stillness.
  FALL_MIN_CONFIDENCE: z.coerce.number().int().min(1).max(3).default(2),
  // A pending impact that is not confirmed as a fall within this long is forgotten.
  FALL_WINDOW_SECONDS: z.coerce.number().int().positive().default(45),
  // Yellow warnings (sudden motion, warning heart rate, skin temperature, not worn, offline). Off: only red alerts.
  WARNING_ALERTS_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  // Acceleration magnitude below this (g) between snapshots is weightlessness: the start of a fall.
  FALL_FREEFALL_G: z.coerce.number().positive().default(0.4),
  // After an impact, movement of this size (g per axis between snapshots) is moving around, not lying hurt: cancels the fall.
  // Smaller movements (breathing, a twitching hand) are ignored.
  FALL_GET_UP_DELTA_G: z.coerce.number().positive().default(0.4),
  // Gravity direction change (degrees) between before the impact and now that counts as having ended up lying.
  FALL_ORIENTATION_DEG: z.coerce.number().positive().default(45),
  REST_SECONDS: z.coerce.number().int().min(0).default(10),
  MOVE_DELTA_G: z.coerce.number().positive().default(0.15),
  // Readings whose observedAt is further than this from server time are stored but never alert.
  READING_MAX_SKEW_SECONDS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, string | undefined>): Env => envSchema.parse(raw);

export const env: Env = parseEnv(process.env);
