import { ThresholdEngine, type ThresholdDir } from "./threshold-engine.js";

/**
 * DEMO-ONLY personal skin-temperature rule. Not a fever detector.
 *
 * The first `baselineSamples` valid readings of a device set its personal normal level (their mean).
 * After that, a reading more than `deltaC` away from it for `durationMs` raises one warning
 * (ThresholdEngine semantics: streak resets on in-range or missing values, cooldown per direction).
 * While readings stay in range the baseline follows slowly (EMA), so slow drift is not an alert.
 * State is in memory and resets when the API restarts.
 */
export interface TempBaselineRule {
  baselineSamples: number;
  deltaC: number;
  durationMs: number;
  minSamples: number;
  cooldownMs: number;
}

const DRIFT = 0.01; // EMA weight of each in-range reading on the baseline

export class TempBaselineEngine {
  private state = new Map<string, { samples: number[]; baseline: number | null; engine: ThresholdEngine | null }>();

  constructor(private rule: TempBaselineRule) {}

  ingest(deviceId: string, atMs: number, value: number | null): ThresholdDir | null {
    let st = this.state.get(deviceId);
    if (!st) {
      st = { samples: [], baseline: null, engine: null };
      this.state.set(deviceId, st);
    }
    if (st.baseline === null) {
      if (value === null || !Number.isFinite(value)) return null;
      st.samples.push(value);
      if (st.samples.length >= this.rule.baselineSamples) {
        st.baseline = st.samples.reduce((a, b) => a + b, 0) / st.samples.length;
        st.samples = [];
      }
      return null;
    }
    const baseline = st.baseline;
    // A fresh engine per baseline value keeps ThresholdEngine's fixed-range semantics.
    if (!st.engine) st.engine = this.engineFor(baseline);
    const dir = st.engine.ingest(deviceId, atMs, value);
    if (value !== null && Number.isFinite(value) && Math.abs(value - baseline) < this.rule.deltaC) {
      const next = baseline + DRIFT * (value - baseline);
      if (Math.abs(next - baseline) >= 0.05) {
        st.baseline = next;
        st.engine = this.engineFor(next);
      }
    }
    return dir;
  }

  /** Personal normal level once known (for tests/diagnostics). */
  baseline(deviceId: string): number | null {
    return this.state.get(deviceId)?.baseline ?? null;
  }

  private engineFor(baseline: number) {
    return new ThresholdEngine({
      low: baseline - this.rule.deltaC,
      high: baseline + this.rule.deltaC,
      durationMs: this.rule.durationMs,
      minSamples: this.rule.minSamples,
      cooldownMs: this.rule.cooldownMs,
    });
  }
}
