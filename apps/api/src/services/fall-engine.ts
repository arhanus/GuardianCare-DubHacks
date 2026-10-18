/**
 * DEMO-ONLY motion state per device. Not a validated fall detector.
 *
 * - `moving`: the accelerometer changed noticeably since the previous snapshot (or is far from 1 g).
 * - `resting`: no movement for at least restMs (used to gate the heart-rate rules: "at rest").
 * - Fall: an impact followed by stillMs without *noticeable* movement raises one critical FALL alert.
 *   Nobody lies perfectly still, so small movements (breathing, a twitching hand, moving an arm) are ignored.
 *   A snapshot that changes any axis by getUpDeltaG or more (or is far from 1 g) means the wearer is moving
 *   around, and cancels the pending fall.
 * - Confidence (1-3) = impact+stillness, +1 if free fall (weightlessness) preceded the impact,
 *   +1 if the gravity direction changed (ended up lying). stillMs is counted from the impact.
 * Snapshots without accelerometer data count as unknown: they neither prove stillness nor movement.
 * State is in memory.
 */
export interface FallRule {
  /** Axis change between snapshots that counts as movement (g). */
  moveDeltaG: number;
  /** |magnitude - 1 g| above this counts as movement (g). */
  moveMagnitudeG: number;
  /** Time without movement before the wearer counts as resting. */
  restMs: number;
  /** Time after an impact, without noticeable movement (see getUpDeltaG), before a fall is raised. */
  stillMs: number;
  /** After the impact, movement within this grace period does not cancel (the bounce of the impact itself). */
  graceMs: number;
  cooldownMs: number;
  /** After the grace period, an axis change of at least this much (g) between snapshots is moving around: cancels. Default 0.4. */
  getUpDeltaG?: number;
  /** Gravity direction change (degrees) that counts as lying down. Default 45. */
  orientationDeg?: number;
  /** Evidence needed to raise a fall (1-3, see `lastConfidence`). Default 1. */
  minConfidence?: number;
  /** A pending impact not confirmed within this long is dropped. Default: never. */
  windowMs?: number;
}

type Accel = { x: number; y: number; z: number };

export class FallEngine {
  private prev = new Map<string, Accel>();
  private lastMove = new Map<string, number>();
  private impactAt = new Map<string, number>();
  private lastAlert = new Map<string, number>();
  private freeFallAt = new Map<string, number>();
  private preImpact = new Map<string, Accel>();
  private confidence = new Map<string, number>();

  constructor(private rule: FallRule) {}

  /** Confidence of the most recent fall this engine returned true for (0 if none yet). */
  lastConfidence(deviceId: string): number {
    return this.confidence.get(deviceId) ?? 0;
  }

  /**
   * Call once per snapshot, before `resting()` / after the impact check. `freeFall` = the wristband saw
   * weightlessness since the previous snapshot. Returns true if a fall should be raised.
   */
  ingest(deviceId: string, atMs: number, accel: Accel | null, impact: boolean, freeFall = false): boolean {
    const before = this.prev.get(deviceId);
    let moving = false;
    let jump = 0;
    if (accel) {
      this.prev.set(deviceId, accel);
      jump = before ? Math.max(Math.abs(accel.x - before.x), Math.abs(accel.y - before.y), Math.abs(accel.z - before.z)) : 0;
      moving = jump >= this.rule.moveDeltaG || Math.abs(Math.hypot(accel.x, accel.y, accel.z) - 1) >= this.rule.moveMagnitudeG;
    }
    if (freeFall) this.freeFallAt.set(deviceId, atMs);
    if (moving || impact) this.lastMove.set(deviceId, atMs);

    if (impact) {
      this.impactAt.set(deviceId, atMs);
      if (before) this.preImpact.set(deviceId, before); // how gravity pointed before the fall
      return false;
    }
    const at = this.impactAt.get(deviceId);
    if (at === undefined) return false;
    // Small movements are ignored; only noticeable movement after the settling period means "not a fall".
    const active = accel !== null && (jump >= (this.rule.getUpDeltaG ?? 0.4) || Math.abs(Math.hypot(accel.x, accel.y, accel.z) - 1) >= this.rule.moveMagnitudeG);
    if (active && atMs - at > this.rule.graceMs) {
      this.impactAt.delete(deviceId); // got up / moved around: not a fall
      return false;
    }
    if (atMs - at > (this.rule.windowMs ?? Infinity)) {
      this.impactAt.delete(deviceId); // never confirmed: a bump, not a fall
      return false;
    }
    if (!accel) return false;

    let confidence = 1;
    const fallAt = this.freeFallAt.get(deviceId);
    if (fallAt !== undefined && at - fallAt <= 2000 && fallAt <= at) confidence++;
    const pre = this.preImpact.get(deviceId);
    if (pre && angleDeg(pre, accel) >= (this.rule.orientationDeg ?? 45)) confidence++;
    if (confidence < (this.rule.minConfidence ?? 1)) return false; // keep waiting: orientation/free fall may still show up
    if (atMs - at < this.rule.stillMs) return false;

    this.confidence.set(deviceId, confidence);
    this.impactAt.delete(deviceId);
    const last = this.lastAlert.get(deviceId);
    if (last !== undefined && atMs - last < this.rule.cooldownMs) return false;
    this.lastAlert.set(deviceId, atMs);
    return true;
  }

  /** True when the wearer has not moved for restMs (or no movement data has been seen yet). */
  resting(deviceId: string, atMs: number): boolean {
    const last = this.lastMove.get(deviceId);
    return last === undefined || atMs - last >= this.rule.restMs;
  }
}

/** Angle between two gravity vectors; 0 if either is (near) zero. */
function angleDeg(a: Accel, b: Accel): number {
  const na = Math.hypot(a.x, a.y, a.z);
  const nb = Math.hypot(b.x, b.y, b.z);
  if (na < 0.1 || nb < 0.1) return 0;
  const cos = (a.x * b.x + a.y * b.y + a.z * b.z) / (na * nb);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}
