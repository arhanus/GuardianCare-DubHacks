import { randomUUID } from "node:crypto";
import type { Alert, DeviceRow, PatientRow, Reading, Store } from "./store.js";

export const DEMO_PATIENT_C_ID = "11111111-1111-4111-8111-111111111203";

/** In-memory store for tests and for running without Supabase credentials. Same seed as the SQL seed. */
export function createMemoryStore(deviceId = "guardian-001"): Store {
  const patients = [
    { id: "11111111-1111-4111-8111-111111111201", displayName: "Margaret Collins", roomNumber: "201" },
    { id: "11111111-1111-4111-8111-111111111202", displayName: "Robert Hayes", roomNumber: "202" },
    { id: DEMO_PATIENT_C_ID, displayName: "Eleanor Brooks", roomNumber: "203" },
  ];
  const devices = new Map<string, DeviceRow>([
    [deviceId, { id: deviceId, patientId: DEMO_PATIENT_C_ID, lastSeenAt: null }],
  ]);
  const alerts: Alert[] = [];
  const readings: Reading[] = [];
  const pushTokens = new Set<string>();

  const newAlert = (a: Partial<Alert> & Pick<Alert, "patientId" | "deviceId" | "type" | "severity" | "source">): Alert => ({
    id: randomUUID(),
    eventId: null,
    detail: null,
    status: "open",
    createdAt: new Date().toISOString(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    ...a,
  });

  return {
    async getDevice(id) {
      return devices.get(id) ?? null;
    },
    async touchDevice(id, at) {
      const d = devices.get(id);
      if (d) d.lastSeenAt = at.toISOString();
    },
    async createSosAlert(input) {
      // No await between check and push: atomic on the single-threaded event loop,
      // mirroring INSERT ... ON CONFLICT (event_id) DO NOTHING.
      const existing = alerts.find((a) => a.eventId === input.eventId);
      if (existing) return { alert: existing, created: false };
      const alert = newAlert({ ...input, type: "SOS", severity: "urgent" });
      alerts.push(alert);
      return { alert, created: true };
    },
    async createSensorAlert(input) {
      const alert = newAlert(input);
      alerts.push(alert);
      return alert;
    },
    async acknowledgeAlert(id, userId) {
      const a = alerts.find((x) => x.id === id);
      if (!a) return null;
      if (a.status !== "open") return { alert: a, changed: false };
      a.status = "acknowledged";
      a.acknowledgedAt = new Date().toISOString();
      a.acknowledgedBy = userId;
      return { alert: a, changed: true };
    },
    async resolveAlert(id, userId, note) {
      const a = alerts.find((x) => x.id === id);
      if (!a) return null;
      if (a.status === "resolved") return { alert: a, changed: false };
      const now = new Date().toISOString();
      if (a.status === "open") {
        a.acknowledgedAt = now;
        a.acknowledgedBy = userId;
      }
      a.status = "resolved";
      a.resolvedAt = now;
      a.resolvedBy = userId;
      a.resolutionNote = note;
      return { alert: a, changed: true };
    },
    async listAlerts({ status, limit }) {
      return alerts
        .filter((a) => status === "all" || a.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async listPatients(): Promise<PatientRow[]> {
      return patients.map((p) => ({
        ...p,
        device: [...devices.values()].find((d) => d.patientId === p.id) ?? null,
      }));
    },
    async patientExists(id) {
      return patients.some((p) => p.id === id);
    },
    async savePushToken(token) {
      pushTokens.add(token);
    },
    async deletePushToken(token) {
      pushTokens.delete(token);
    },
    async listPushTokens() {
      return [...pushTokens];
    },
    async countOpenAlertsByPatient() {
      const out: Record<string, number> = {};
      for (const a of alerts) if (a.status === "open") out[a.patientId] = (out[a.patientId] ?? 0) + 1;
      return out;
    },
    async insertReading(input) {
      const existing = readings.find((r) => r.readingId === input.readingId);
      if (existing) return { reading: existing, created: false };
      const reading: Reading = { ...input, id: randomUUID(), receivedAt: new Date().toISOString() };
      readings.push(reading);
      return { reading, created: true };
    },
    async listReadings(patientId, limit) {
      return readings
        .filter((r) => r.patientId === patientId)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        .slice(0, limit);
    },
    async latestReadings(patientIds) {
      const out: Record<string, Reading> = {};
      for (const id of patientIds) {
        const r = readings.filter((x) => x.patientId === id).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
        if (r) out[id] = r;
      }
      return out;
    },
  };
}
