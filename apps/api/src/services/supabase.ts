import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import { createMemoryStore } from "./memory-store.js";
import { createSupabaseStore } from "./supabase-store.js";
import type { Store } from "./store.js";

/** Service-role/secret client. Backend only; bypasses RLS. */
export function createAdminClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createStore(env: Env, log: { warn: (m: string) => void }): Store {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return createSupabaseStore(createAdminClient(env));
  }
  if (env.NODE_ENV === "production") {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production");
  }
  log.warn("Supabase not configured: using IN-MEMORY store (data is lost on restart, nothing reaches the app)");
  return createMemoryStore(env.DEVICE_ID);
}
