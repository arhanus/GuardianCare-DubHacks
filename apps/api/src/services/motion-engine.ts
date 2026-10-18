/**
 * DEMO-ONLY sudden-motion rule. Not a validated fall detector.
 * Fires when any of these holds for a snapshot (acceleration in g):
 *  - any single axis changed by >= axisDeltaG since the previous snapshot,
 *  - the firmware-reported peak jerk since the previous snapshot is >= jerkG,
 *  - the peak or current acceleration magnitude is >= impactG (the MPU sensor clips at 2 g).
 * A per-device cooldown prevents repeat alarms. State is in memory.
 */
export interface MotionRule {
  axisDeltaG: number;
  jerkG: number;
  impactG: number;
  cooldownMs: number;
}

export interface MotionSample {
  atMs: number;
  accel: { x: number; y: number; z: number } | null;
  peakAccelG?: number | null;
  peakJerkG?: number | null;
}

export class MotionEngine {
  private prev = new Map<string, { x: number; y: number; z: number }>();
  private lastAlert = new Map<string, number>();

  constructor(private rule: MotionRule) {}

  ingest(deviceId: string, s: MotionSample): boolean {
    const a = s.accel;
    const before = this.prev.get(deviceId);
    if (a) this.prev.set(deviceId, a);

    const magnitude = a ? Math.hypot(a.x, a.y, a.z) : 0;
    const axisJump = a && before ? Math.max(Math.abs(a.x - before.x), Math.abs(a.y - before.y), Math.abs(a.z - before.z)) : 0;
    const tripped =
      axisJump >= this.rule.axisDeltaG ||
      (s.peakJerkG ?? 0) >= this.rule.jerkG ||
      Math.max(s.peakAccelG ?? 0, magnitude) >= this.rule.impactG;
    if (!tripped) return false;

    const last = this.lastAlert.get(deviceId);
    if (last !== undefined && s.atMs - last < this.rule.cooldownMs) return false;
    this.lastAlert.set(deviceId, s.atMs);
    return true;
  }
}
