import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { AppError } from "./errors.js";

/** Constant-time string compare (hash first so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Device key from `x-device-key` (repo contract), `x-api-key` (firmware) or `Authorization: Bearer`. */
export function extractDeviceKey(req: FastifyRequest): string | null {
  for (const name of ["x-device-key", "x-api-key"]) {
    const h = req.headers[name];
    if (typeof h === "string" && h) return h;
  }
  const auth = req.headers.authorization;
  if (typeof auth === "string") {
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Throws 401 unless the request carries the configured device key. An unset key rejects everything. */
export function requireDeviceKey(req: FastifyRequest, configuredKey: string): void {
  const presented = extractDeviceKey(req);
  if (!configuredKey || !presented || !safeEqual(presented, configuredKey)) {
    throw new AppError(401, "unauthorized", "Invalid or missing device key");
  }
}

export interface NurseVerifierLike {
  verify(token: string): Promise<{ id: string } | null>;
}

/** Validates `Authorization: Bearer <supabase access token>`; returns the user id. Throws 401 otherwise. */
export async function requireNurse(req: FastifyRequest, verifier: NurseVerifierLike): Promise<{ id: string }> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "");
  const user = m?.[1] ? await verifier.verify(m[1]) : null;
  if (!user) throw new AppError(401, "unauthorized", "Invalid or missing access token");
  return user;
}
