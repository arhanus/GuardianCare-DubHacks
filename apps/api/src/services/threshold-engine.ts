/**
 * DEMO-ONLY sustained-threshold rule for a single scalar (used for skin temperature).
 * Same semantics as HrEngine: alerts only after >= minSamples consecutive samples spanning
 * >= durationMs on the same side of the range; null or in-range samples reset the streak;
 * a cooldown suppresses repeats per device+direction. State is in memory.
 */
export interface ThresholdRule {
  low: number;
  high: number;
  durationMs: number;
  minSamples: number;
  cooldownMs: number;
}

export type ThresholdDir = "HIGH" | "LOW";

export class ThresholdEngine {
  private streaks = new Map<string, { dir: ThresholdDir; times: number[] }>();
  private lastAlert = new Map<string, number>();

  constructor(private rule: ThresholdRule) {}

  ingest(deviceId: string, atMs: number, value: number | null): ThresholdDir | null {
    if (value === null || !Number.isFinite(value)) {
      this.streaks.delete(deviceId);
      return null;
    }
    const dir: ThresholdDir | null = value > this.rule.high ? "HIGH" : value < this.rule.low ? "LOW" : null;
    if (!dir) {
      this.streaks.delete(deviceId);
      return null;
    }
    let st = this.streaks.get(deviceId);
    if (!st || st.dir !== dir) {
      st = { dir, times: [] };
      this.streaks.set(deviceId, st);
    }
    st.times.push(atMs);
    if (st.times.length < this.rule.minSamples || atMs - (st.times[0] ?? atMs) < this.rule.durationMs) return null;

    const key = `${deviceId}:${dir}`;
    const last = this.lastAlert.get(key);
    if (last !== undefined && atMs - last < this.rule.cooldownMs) return null;
    this.lastAlert.set(key, atMs);
    this.streaks.delete(deviceId);
    return dir;
  }
}
