import type { Alert, LiveReading } from "@guardiancare/contracts";
import type { CareEvent } from "./event-policy";

/** Newest readings kept per patient for the live indicators/charts. */
export const MAX_READINGS = 120;

/** Appends a reading (oldest first), dropping duplicates by id and trimming to MAX_READINGS. */
export function appendReading(buffer: LiveReading[], reading: LiveReading): LiveReading[] {
  if (buffer.some(item => item.id === reading.id)) return buffer;
  const next = [...buffer, reading].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return next.length > MAX_READINGS ? next.slice(next.length - MAX_READINGS) : next;
}

export function relativeTime(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "No readings yet";
  const seconds = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

const f1 = (value: number | null | undefined, unit: string) => value == null ? "" : ` ${value.toFixed(1)}${unit}`;

/** Short title for the alert, shown in lists and the alarm screen. */
export function alertTitle(alert: Alert): string {
  switch (alert.detail) {
    case "SUDDEN_MOTION": return "Sudden motion detected";
    case "FALL": return "Possible fall";
    case "NOT_WORN": return "Wristband not worn";
    case "OFFLINE": return "Wristband offline";
    case "HR_HIGH": return "Heart rate too high";
    case "HR_LOW": return "Heart rate too low";
    case "TEMP_HIGH": return "Skin temperature too high";
    case "TEMP_LOW": return "Skin temperature too low";
    default: return alert.source === "app" ? "SOS pressed in the app" : "SOS received";
  }
}

/** Plain-language description, with the latest value when we have one. */
export function alertDescription(alert: Alert, latest?: LiveReading | null): string {
  switch (alert.detail) {
    case "SUDDEN_MOTION": {
      const a = latest?.accelerationG;
      return `The wristband felt a sudden movement or impact${a ? ` (x ${a.x.toFixed(2)} g, y ${a.y.toFixed(2)} g, z ${a.z.toFixed(2)} g)` : ""}. Check on the person now.`;
    }
    case "NOT_WORN":
      return "The wristband is not touching skin. It may have been taken off, so this resident is not being monitored. Check that it is on their wrist.";
    case "OFFLINE":
      return "The wristband stopped sending data. It may be out of Wi-Fi range or out of battery, so this resident is not being monitored. Check the wristband.";
    case "FALL":
      return "An impact was followed by about 10 seconds without movement. The person may have fallen. Check on them now.";
    case "HR_HIGH":
    case "HR_LOW":
      return `Heart rate at rest stayed ${alert.detail === "HR_HIGH" ? "above" : "below"} the ${alert.severity === "warning" ? "warning" : "critical"} range${latest?.heartRateBpm != null ? ` (${latest.heartRateBpm} bpm)` : ""}. Demo thresholds, not a diagnosis.`;
    case "TEMP_HIGH":
    case "TEMP_LOW":
      return `Skin temperature stayed about 1 °C ${alert.detail === "TEMP_HIGH" ? "above" : "below"} this person's normal level${f1(latest?.skinTemperatureC, " °C")}. Skin, not core, temperature.`;
    default:
      return alert.source === "app" ? "The SOS button in the app was pressed. Check the person now." : "The wristband SOS was triggered. Check the person now.";
  }
}

const TYPE_LABEL: Record<Alert["type"], string> = { SOS: "SOS", MOTION_ALERT: "Motion", HEART_RATE_ALERT: "Heart rate", TEMPERATURE_ALERT: "Temperature", DEVICE_ALERT: "Wristband" };

/** Backend alert -> the app's CareEvent. open -> received, acknowledged -> accepted, resolved -> closed. */
export function toCareEvent(alert: Alert, personId: string, latest?: LiveReading | null): CareEvent {
  const created = new Date(alert.createdAt);
  return {
    id: alert.id,
    personId,
    title: alertTitle(alert),
    type: TYPE_LABEL[alert.type] ?? alert.type,
    time: created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    recordedAt: alert.createdAt,
    description: alertDescription(alert, latest),
    responding: alert.status !== "open",
    status: alert.status === "open" ? "received" : alert.status === "acknowledged" ? "accepted" : "closed",
    resolutionNote: alert.resolutionNote ?? null,
    resolvedAt: alert.resolvedAt ?? null,
    resolvedBy: alert.resolvedBy ?? null,
    remote: true,
    severity: alert.severity === "warning" ? "warning" : "critical",
  };
}

/** Tolerance for phone/server clock differences: alerts created up to this long before sign-in still ring. */
export const RING_LOOKBACK_MS = 15 * 1000;

/**
 * Which alerts should ring right now: remote, still waiting for a response, and created after `since`
 * (the sign-in time). Older open alerts are listed as "Needs response" but stay silent. `since` is fixed,
 * so a ringing alarm never silences itself.
 */
export function ringingEvents(events: CareEvent[], since: number): CareEvent[] {
  return events.filter(event => event.remote && event.status === "received" && event.severity !== "warning" && Date.parse(event.recordedAt ?? "") >= since);
}

/** The newest reading received at or before the given time (what the wristband said when the alert fired). */
export function readingAt(buffer: LiveReading[] | undefined, iso: string): LiveReading | null {
  if (!buffer?.length) return null;
  let found: LiveReading | null = null;
  for (const reading of buffer) if (reading.receivedAt <= iso) found = reading;
  return found ?? buffer[0] ?? null;
}

export function movementLabel(reading: LiveReading | null | undefined): string {
  if (reading?.motionG == null) return "Unavailable";
  return Math.abs(reading.motionG - 1) > 0.15 ? "Recent movement" : "No recent movement";
}

export type Series = { labels: string[]; values: number[] };

/** One metric over time: skips readings where the sensor had no value (null), never invents data. */
export function series(buffer: LiveReading[] | undefined, pick: (reading: LiveReading) => number | null): Series {
  const out: Series = { labels: [], values: [] };
  for (const reading of buffer ?? []) {
    const value = pick(reading);
    if (value == null || !Number.isFinite(value)) continue;
    out.values.push(value);
    out.labels.push(new Date(reading.receivedAt).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }));
  }
  return out;
}

export const pickHeartRate = (reading: LiveReading) => reading.heartRateBpm;
export const pickTemperature = (reading: LiveReading) => reading.skinTemperatureC == null ? null : Number(reading.skinTemperatureC.toFixed(1));
export const pickMotion = (reading: LiveReading) => reading.motionG == null ? null : Number(reading.motionG.toFixed(2));

/** A critical alarm nobody accepted for this long is "escalated": louder, and shown to every caregiver. */
export const ESCALATE_AFTER_MS = 2 * 60 * 1000;

/** How long a critical event has waited (null when it is not waiting) and whether it is escalated. */
export function escalation(event: CareEvent, nowMs: number): { waitingMs: number; escalated: boolean } | null {
  if (!event.remote || event.status !== "received" || event.severity === "warning" || !event.recordedAt) return null;
  const waitingMs = Math.max(0, nowMs - Date.parse(event.recordedAt));
  return { waitingMs, escalated: waitingMs >= ESCALATE_AFTER_MS };
}

/** "2:14" */
export function waitLabel(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Quick check notes caregivers can tap when closing an event. */
export const NOTE_CHIPS = ["Checked, no injury", "Helped up", "Called doctor", "False alarm"] as const;

/** Events of the last `hours` hours for the shift handover, newest first, split into open and closed. */
export function handover(events: CareEvent[], nowMs: number, hours = 12) {
  const since = nowMs - hours * 3600 * 1000;
  const recent = events.filter(event => event.remote && event.recordedAt && Date.parse(event.recordedAt) >= since)
    .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""));
  const open = recent.filter(event => event.status !== "closed");
  const closed = recent.filter(event => event.status === "closed");
  return { open, closed, total: recent.length, critical: recent.filter(event => event.severity !== "warning").length };
}

/** Plain-text handover for sharing, e.g. in the staff group chat. */
export function handoverText(events: CareEvent[], nameOf: (personId: string) => string, nowMs: number, hours = 12): string {
  const { open, closed, total } = handover(events, nowMs, hours);
  const time = (event: CareEvent) => new Date(event.recordedAt ?? "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const lines = [`GuardianCare shift handover, last ${hours} h: ${total} events, ${open.length} still open`];
  if (open.length) lines.push("", "OPEN:", ...open.map(event => `- ${time(event)} ${nameOf(event.personId)}: ${event.title} (${event.status === "received" ? "not accepted" : "in progress"})`));
  if (closed.length) lines.push("", "CLOSED:", ...closed.map(event => `- ${time(event)} ${nameOf(event.personId)}: ${event.title}. ${event.resolutionNote ?? "No note"}`));
  return lines.join("\n");
}
