import type { LiveHub } from "./live-hub.js";
import type { Store } from "./store.js";

/**
 * DEMO-ONLY "wristband offline" rule. A device that was alive and has sent nothing for `offlineMs`
 * raises one warning per episode; a new reading ends the episode. Devices already offline when the API
 * starts are not alerted (they were handled before the restart). State is in memory.
 */
export class OfflineWatch {
  private raised = new Set<string>();
  private first = true;

  constructor(
    private deps: { store: Store; hub: LiveHub; offlineMs: number; onError: (err: unknown) => void },
  ) {}

  async check(nowMs: number): Promise<void> {
    try {
      const patients = await this.deps.store.listPatients();
      const seeding = this.first;
      this.first = false;
      for (const p of patients) {
        const d = p.device;
        if (!d?.lastSeenAt) continue;
        const offline = nowMs - Date.parse(d.lastSeenAt) >= this.deps.offlineMs;
        if (!offline) {
          this.raised.delete(d.id);
          continue;
        }
        if (this.raised.has(d.id)) continue;
        this.raised.add(d.id);
        if (seeding) continue;
        const alert = await this.deps.store.createSensorAlert({
          patientId: p.id,
          deviceId: d.id,
          type: "DEVICE_ALERT",
          detail: "OFFLINE",
          severity: "warning",
          source: "device",
        });
        this.deps.hub.publish({ type: "alert", alert });
      }
    } catch (err) {
      this.deps.onError(err);
    }
  }
}
