/**
 * DEMO-ONLY "wristband not worn" rule. The firmware reports heart.status = NO_CONTACT while the
 * optical sensor is not on skin. Fires once per episode after `notWornMs` of continuous no-contact;
 * any snapshot with contact ends the episode. Snapshots with unknown contact (null) change nothing.
 * State is in memory.
 */
export class WearEngine {
  private since = new Map<string, number>();
  private raised = new Set<string>();

  constructor(private rule: { notWornMs: number }) {}

  ingest(deviceId: string, atMs: number, contact: boolean | null): boolean {
    if (contact === null) return false;
    if (contact) {
      this.since.delete(deviceId);
      this.raised.delete(deviceId);
      return false;
    }
    const start = this.since.get(deviceId) ?? atMs;
    this.since.set(deviceId, start);
    if (atMs - start < this.rule.notWornMs || this.raised.has(deviceId)) return false;
    this.raised.add(deviceId);
    return true;
  }
}
