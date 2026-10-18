/**
 * DEMO-ONLY sudden-motion rule. Not a validated fall detector.
 * Fires when any of these holds for a snapshot (acceleration in g):
 *  - any single axis changed by >= axisDeltaG since the previous snapshot (only when the source sends no peaks),
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
  private tripped = new Map<string, boolean>();
  private impact = new Map<string, boolean>();

  constructor(private rule: MotionRule) {}

  /** Whether the latest snapshot crossed the threshold, even if the alert was suppressed by the cooldown. */
  wasTripped(deviceId: string): boolean {
    return this.tripped.get(deviceId) ?? false;
  }

  /**
   * Whether the latest snapshot held a real impact. With firmware peaks this equals `wasTripped`;
   * without them `wasTripped` also counts the axis-delta rule and this falls back to it.
   */
  wasImpact(deviceId: string): boolean {
    return this.impact.get(deviceId) ?? false;
  }

  ingest(deviceId: string, s: MotionSample): boolean {
    const a = s.accel;
    const before = this.prev.get(deviceId);
    if (a) this.prev.set(deviceId, a);

    const magnitude = a ? Math.hypot(a.x, a.y, a.z) : 0;
    const axisJump = a && before ? Math.max(Math.abs(a.x - before.x), Math.abs(a.y - before.y), Math.abs(a.z - before.z)) : 0;
    const hasPeaks = s.peakAccelG != null || s.peakJerkG != null;
    const impact = (s.peakJerkG ?? 0) >= this.rule.jerkG || Math.max(s.peakAccelG ?? 0, magnitude) >= this.rule.impactG;
    // Snapshots are 1 s apart, so the axis-delta rule fires on ordinary arm movement. It is only the fallback
    // for sources that report no 50 Hz peaks (the wristband always does).
    const tripped = hasPeaks ? impact : axisJump >= this.rule.axisDeltaG || impact;
    this.tripped.set(deviceId, tripped);
    this.impact.set(deviceId, hasPeaks ? impact : tripped);
    if (!tripped) return false;

    const last = this.lastAlert.get(deviceId);
    if (last !== undefined && s.atMs - last < this.rule.cooldownMs) return false;
    this.lastAlert.set(deviceId, s.atMs);
    return true;
  }
}
