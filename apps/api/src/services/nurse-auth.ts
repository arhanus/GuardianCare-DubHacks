import { createClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";

export interface NurseVerifier {
  /** Returns the authenticated Supabase user id, or null for an invalid/expired token. */
  verify(token: string): Promise<{ id: string } | null>;
}

/** Dev-only token accepted when Supabase isn't configured. Never active in production. */
export const DEV_NURSE_TOKEN = "dev-nurse-token";
export const DEV_NURSE_ID = "00000000-0000-4000-8000-000000000001";

export function createNurseVerifier(env: Env, log: { warn: (m: string) => void }): NurseVerifier {
  const key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.SUPABASE_URL && key) {
    // Token is validated by Supabase Auth itself (signature, expiry, revocation).
    const client = createClient(env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return {
      async verify(token) {
        const { data, error } = await client.auth.getUser(token);
        return error || !data.user ? null : { id: data.user.id };
      },
    };
  }
  if (env.NODE_ENV === "production") throw new Error("Supabase must be configured in production");
  log.warn(`Supabase not configured: nurse auth accepts the DEV token "${DEV_NURSE_TOKEN}" only`);
  return { verify: async (t) => (t === DEV_NURSE_TOKEN ? { id: DEV_NURSE_ID } : null) };
}
