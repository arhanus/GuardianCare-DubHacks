/**
 * DEMO-ONLY heart-rate rule. Thresholds are example values, not clinical guidance, and this is
 * not a detector of any medical condition.
 *
 * Alerts only after >= minSamples consecutive eligible samples, spanning >= durationMs, all on the
 * same side of the threshold. Any ineligible sample (null HR, poor/unknown quality, stale or
 * future observedAt) or in-range sample resets the streak. Cooldown suppresses repeats per
 * device+direction.
 *
 * State is in memory: it resets on restart and is per API instance.
 */
export interface HrRule {
  lowBpm: number;
  highBpm: number;
  durationMs: number;
  minSamples: number;
  cooldownMs: number;
}

export interface HrSample {
  /** Server receive time (ms). Authoritative; device clocks are not trusted. */
  atMs: number;
  heartRateBpm: number | null;
  quality: "good" | "poor" | "unknown";
  /** False if observedAt was stale/future relative to server time. */
  fresh: boolean;
}

type Dir = "HR_HIGH" | "HR_LOW";

export class HrEngine {
  private streaks = new Map<string, { dir: Dir; times: number[] }>();
  private lastAlert = new Map<string, number>();

  constructor(private rule: HrRule) {}

  ingest(deviceId: string, s: HrSample): Dir | null {
    const hr = s.heartRateBpm;
    if (hr === null || s.quality !== "good" || !s.fresh) {
      this.streaks.delete(deviceId);
      return null;
    }
    const dir: Dir | null = hr > this.rule.highBpm ? "HR_HIGH" : hr < this.rule.lowBpm ? "HR_LOW" : null;
    if (!dir) {
      this.streaks.delete(deviceId);
      return null;
    }
    let st = this.streaks.get(deviceId);
    if (!st || st.dir !== dir) {
      st = { dir, times: [] };
      this.streaks.set(deviceId, st);
    }
    st.times.push(s.atMs);
    const span = s.atMs - (st.times[0] ?? s.atMs);
    if (st.times.length < this.rule.minSamples || span < this.rule.durationMs) return null;

    const key = `${deviceId}:${dir}`;
    const last = this.lastAlert.get(key);
    if (last !== undefined && s.atMs - last < this.rule.cooldownMs) return null;
    this.lastAlert.set(key, s.atMs);
    this.streaks.delete(deviceId);
    return dir;
  }
}
