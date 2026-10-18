/**
 * DEMO-ONLY motion state per device. Not a validated fall detector.
 *
 * - `moving`: the accelerometer changed noticeably since the previous snapshot (or is far from 1 g).
 * - `resting`: no movement for at least restMs (used to gate the heart-rate rules: "at rest").
 * - Fall: an impact (same trigger as the sudden-motion warning) followed by stillMs without movement
 *   raises one critical FALL alert. Any movement during the still window cancels it.
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
  /** Time without movement after an impact before a fall is raised. */
  stillMs: number;
  /** After the impact, movement within this grace period does not cancel (the bounce of the impact itself). */
  graceMs: number;
  cooldownMs: number;
}

type Accel = { x: number; y: number; z: number };

export class FallEngine {
  private prev = new Map<string, Accel>();
  private lastMove = new Map<string, number>();
  private impactAt = new Map<string, number>();
  private lastAlert = new Map<string, number>();

  constructor(private rule: FallRule) {}

  /** Call once per snapshot, before `resting()` / after the impact check. Returns true if a fall should be raised. */
  ingest(deviceId: string, atMs: number, accel: Accel | null, impact: boolean): boolean {
    const before = this.prev.get(deviceId);
    let moving = false;
    if (accel) {
      this.prev.set(deviceId, accel);
      const jump = before ? Math.max(Math.abs(accel.x - before.x), Math.abs(accel.y - before.y), Math.abs(accel.z - before.z)) : 0;
      moving = jump >= this.rule.moveDeltaG || Math.abs(Math.hypot(accel.x, accel.y, accel.z) - 1) >= this.rule.moveMagnitudeG;
    }
    if (moving || impact) this.lastMove.set(deviceId, atMs);

    if (impact) {
      this.impactAt.set(deviceId, atMs);
      return false;
    }
    const at = this.impactAt.get(deviceId);
    if (at === undefined) return false;
    if (moving && atMs - at > this.rule.graceMs) {
      this.impactAt.delete(deviceId); // got up / moved: not a fall
      return false;
    }
    const lastMove = this.lastMove.get(deviceId) ?? at;
    if (!accel || atMs - Math.max(at, lastMove) < this.rule.stillMs) return false;

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
