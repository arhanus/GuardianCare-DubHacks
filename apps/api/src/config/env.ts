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
  DEMO_HR_LOW_BPM: z.coerce.number().int().positive().default(50),
  DEMO_HR_HIGH_BPM: z.coerce.number().int().positive().default(120),
  DEMO_HR_DURATION_SECONDS: z.coerce.number().int().positive().default(10),
  DEMO_HR_MIN_SAMPLES: z.coerce.number().int().min(2).default(3),
  DEMO_HR_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  // Readings whose observedAt is further than this from server time are stored but never alert.
  READING_MAX_SKEW_SECONDS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, string | undefined>): Env => envSchema.parse(raw);

export const env: Env = parseEnv(process.env);
