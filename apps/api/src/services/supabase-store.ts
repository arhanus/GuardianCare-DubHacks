import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alert, DeviceRow, PatientRow, Reading, Store } from "./store.js";

// snake_case DB rows <-> camelCase API objects are mapped explicitly here.
interface AlertDb {
  id: string;
  patient_id: string;
  device_id: string;
  event_id: string | null;
  type: Alert["type"];
  detail: Alert["detail"];
  severity: Alert["severity"];
  status: Alert["status"];
  source: Alert["source"];
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}
interface DeviceDb {
  id: string;
  patient_id: string | null;
  last_seen_at: string | null;
}
interface PatientDb {
  id: string;
  display_name: string;
  room_number: string;
}
interface ReadingDb {
  id: string;
  reading_id: string;
  device_id: string;
  patient_id: string;
  heart_rate_bpm: number | null;
  skin_temperature_c: number | string | null;
  acceleration_g: Reading["accelerationG"];
  signal_quality: Reading["signalQuality"];
  source: Reading["source"];
  received_at: string;
  observed_at: string | null;
}

// Postgres returns "+00:00"; the contract shows ISO 8601 "Z". Normalise at the boundary.
const iso = (v: string): string => new Date(v).toISOString();
const isoOrNull = (v: string | null): string | null => (v === null ? null : iso(v));

const ALERT_COLS =
  "id,patient_id,device_id,event_id,type,detail,severity,status,source,created_at,acknowledged_at,acknowledged_by";
const READING_COLS =
  "id,reading_id,device_id,patient_id,heart_rate_bpm,skin_temperature_c,acceleration_g,signal_quality,source,received_at,observed_at";

const toAlert = (r: AlertDb): Alert => ({
  id: r.id,
  patientId: r.patient_id,
  deviceId: r.device_id,
  eventId: r.event_id,
  type: r.type,
  detail: r.detail,
  severity: r.severity,
  status: r.status,
  source: r.source,
  createdAt: iso(r.created_at),
  acknowledgedAt: isoOrNull(r.acknowledged_at),
  acknowledgedBy: r.acknowledged_by,
});

const toDevice = (r: DeviceDb): DeviceRow => ({
  id: r.id,
  patientId: r.patient_id,
  lastSeenAt: isoOrNull(r.last_seen_at),
});

const toReading = (r: ReadingDb): Reading => ({
  id: r.id,
  readingId: r.reading_id,
  deviceId: r.device_id,
  patientId: r.patient_id,
  heartRateBpm: r.heart_rate_bpm,
  // numeric columns can arrive as strings
  skinTemperatureC: r.skin_temperature_c === null ? null : Number(r.skin_temperature_c),
  accelerationG: r.acceleration_g,
  signalQuality: r.signal_quality,
  source: r.source,
  receivedAt: iso(r.received_at),
  observedAt: isoOrNull(r.observed_at),
});

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`supabase: ${res.error.message}`);
  return res.data as T;
}

export function createSupabaseStore(db: SupabaseClient): Store {
  return {
    async getDevice(id) {
      const row = check(
        await db.from("devices").select("id,patient_id,last_seen_at").eq("id", id).maybeSingle<DeviceDb>(),
      );
      return row ? toDevice(row) : null;
    },

    async touchDevice(id, at) {
      check(await db.from("devices").update({ last_seen_at: at.toISOString() }).eq("id", id));
    },

    async createSosAlert({ patientId, deviceId, eventId, source }) {
      // INSERT ... ON CONFLICT (event_id) DO NOTHING: race-safe; only one concurrent request inserts.
      const inserted = check(
        await db
          .from("alerts")
          .upsert(
            { patient_id: patientId, device_id: deviceId, event_id: eventId, type: "SOS", severity: "urgent", status: "open", source },
            { onConflict: "event_id", ignoreDuplicates: true },
          )
          .select(ALERT_COLS)
          .returns<AlertDb[]>(),
      );
      const first = inserted[0];
      if (first) return { alert: toAlert(first), created: true };
      const existing = check(
        await db.from("alerts").select(ALERT_COLS).eq("event_id", eventId).single<AlertDb>(),
      );
      return { alert: toAlert(existing), created: false };
    },

    async createHrAlert({ patientId, deviceId, detail, source }) {
      const row = check(
        await db
          .from("alerts")
          .insert({ patient_id: patientId, device_id: deviceId, event_id: null, type: "HEART_RATE_ALERT", detail, severity: "warning", status: "open", source })
          .select(ALERT_COLS)
          .single<AlertDb>(),
      );
      return toAlert(row);
    },

    async acknowledgeAlert(id, userId) {
      // Conditional update: only the request that flips open -> acknowledged gets a row back.
      const updated = check(
        await db
          .from("alerts")
          .update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
          .eq("id", id)
          .eq("status", "open")
          .select(ALERT_COLS)
          .returns<AlertDb[]>(),
      );
      const first = updated[0];
      if (first) return { alert: toAlert(first), changed: true };
      const existing = check(await db.from("alerts").select(ALERT_COLS).eq("id", id).maybeSingle<AlertDb>());
      return existing ? { alert: toAlert(existing), changed: false } : null;
    },

    async listAlerts({ status, limit }) {
      let q = db.from("alerts").select(ALERT_COLS).order("created_at", { ascending: false }).limit(limit);
      if (status !== "all") q = q.eq("status", status);
      return check(await q.returns<AlertDb[]>()).map(toAlert);
    },

    async listPatients(): Promise<PatientRow[]> {
      const patients = check(
        await db.from("patients").select("id,display_name,room_number").order("room_number").returns<PatientDb[]>(),
      );
      const devices = check(
        await db.from("devices").select("id,patient_id,last_seen_at").returns<DeviceDb[]>(),
      ).map(toDevice);
      return patients.map((p) => ({
        id: p.id,
        displayName: p.display_name,
        roomNumber: p.room_number,
        device: devices.find((d) => d.patientId === p.id) ?? null,
      }));
    },

    async patientExists(id) {
      const row = check(await db.from("patients").select("id").eq("id", id).maybeSingle<{ id: string }>());
      return row !== null;
    },

    async countOpenAlertsByPatient() {
      const rows = check(
        await db.from("alerts").select("patient_id").eq("status", "open").returns<{ patient_id: string }[]>(),
      );
      const out: Record<string, number> = {};
      for (const r of rows) out[r.patient_id] = (out[r.patient_id] ?? 0) + 1;
      return out;
    },

    async insertReading(input) {
      const inserted = check(
        await db
          .from("sensor_readings")
          .upsert(
            {
              reading_id: input.readingId,
              device_id: input.deviceId,
              patient_id: input.patientId,
              heart_rate_bpm: input.heartRateBpm,
              skin_temperature_c: input.skinTemperatureC,
              acceleration_g: input.accelerationG,
              signal_quality: input.signalQuality,
              source: input.source,
              observed_at: input.observedAt,
            },
            { onConflict: "reading_id", ignoreDuplicates: true },
          )
          .select(READING_COLS)
          .returns<ReadingDb[]>(),
      );
      const first = inserted[0];
      if (first) return { reading: toReading(first), created: true };
      const existing = check(
        await db.from("sensor_readings").select(READING_COLS).eq("reading_id", input.readingId).single<ReadingDb>(),
      );
      return { reading: toReading(existing), created: false };
    },

    async listReadings(patientId, limit) {
      return check(
        await db
          .from("sensor_readings")
          .select(READING_COLS)
          .eq("patient_id", patientId)
          .order("received_at", { ascending: false })
          .limit(limit)
          .returns<ReadingDb[]>(),
      ).map(toReading);
    },

    async latestReadings(patientIds) {
      const out: Record<string, Reading> = {};
      await Promise.all(
        patientIds.map(async (pid) => {
          const rows = await this.listReadings(pid, 1);
          if (rows[0]) out[pid] = rows[0];
        }),
      );
      return out;
    },
  };
}
