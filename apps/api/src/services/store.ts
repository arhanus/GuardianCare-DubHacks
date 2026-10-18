/** Persistence boundary. Domain objects here are already in API (camelCase) shape. */

export type AlertStatus = "open" | "acknowledged" | "resolved";
export type Source = "device" | "simulation" | "app";
export type AlertSource = Source;
export type SignalQuality = "good" | "poor" | "unknown";

export type AlertType = "SOS" | "HEART_RATE_ALERT" | "MOTION_ALERT" | "TEMPERATURE_ALERT" | "DEVICE_ALERT";
export type AlertDetail = "HR_HIGH" | "HR_LOW" | "SUDDEN_MOTION" | "FALL" | "TEMP_HIGH" | "TEMP_LOW" | "NOT_WORN" | "OFFLINE";
/** urgent = critical (red, rings until accepted); warning = yellow, does not ring. */
export type Severity = "urgent" | "warning";

export interface Alert {
  id: string;
  patientId: string;
  deviceId: string;
  eventId: string | null;
  type: AlertType;
  /** For sensor alerts: which rule tripped. Additive field. */
  detail: AlertDetail | null;
  severity: Severity;
  status: AlertStatus;
  source: Source;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  /** Set when a caregiver closes the event with a note. */
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface Reading {
  id: string;
  readingId: string;
  deviceId: string;
  patientId: string;
  heartRateBpm: number | null;
  skinTemperatureC: number | null;
  accelerationG: { x: number; y: number; z: number } | null;
  signalQuality: SignalQuality;
  source: Source;
  receivedAt: string;
  observedAt: string | null;
}

export interface NewReading {
  readingId: string;
  deviceId: string;
  patientId: string;
  heartRateBpm: number | null;
  skinTemperatureC: number | null;
  accelerationG: { x: number; y: number; z: number } | null;
  signalQuality: SignalQuality;
  source: Source;
  observedAt: string | null;
}

export interface DeviceRow {
  id: string;
  patientId: string | null;
  lastSeenAt: string | null;
}

export interface PatientRow {
  id: string;
  displayName: string;
  roomNumber: string;
  device: DeviceRow | null;
}

export interface Store {
  getDevice(id: string): Promise<DeviceRow | null>;
  /** Sets last_seen_at to the given server time. */
  touchDevice(id: string, at: Date): Promise<void>;
  /**
   * Atomic insert-or-fetch keyed on eventId (UNIQUE). `created` is false when the
   * eventId already existed; the existing alert is returned.
   */
  createSosAlert(input: {
    patientId: string;
    deviceId: string;
    eventId: string;
    source: Source;
  }): Promise<{ alert: Alert; created: boolean }>;
  /** Backend-generated sensor alert (event_id NULL). */
  createSensorAlert(input: {
    patientId: string;
    deviceId: string;
    type: Exclude<AlertType, "SOS">;
    detail: AlertDetail;
    severity: Severity;
    source: Source;
  }): Promise<Alert>;
  /**
   * open -> acknowledged exactly once. Returns the current record either way, `changed` says whether
   * this call performed the transition. null = no such alert.
   */
  acknowledgeAlert(id: string, userId: string): Promise<{ alert: Alert; changed: boolean } | null>;
  /**
   * open|acknowledged -> resolved with a note (an open alert is also marked acknowledged by the same user).
   * `changed` is false when it was already resolved. null = no such alert.
   */
  resolveAlert(id: string, userId: string, note: string): Promise<{ alert: Alert; changed: boolean } | null>;
  listAlerts(opts: { status: AlertStatus | "all"; limit: number }): Promise<Alert[]>;
  listPatients(): Promise<PatientRow[]>;
  patientExists(id: string): Promise<boolean>;
  countOpenAlertsByPatient(): Promise<Record<string, number>>;
  /** UNIQUE reading_id; duplicate returns the existing row with created=false. */
  insertReading(input: NewReading): Promise<{ reading: Reading; created: boolean }>;
  listReadings(patientId: string, limit: number): Promise<Reading[]>;
  latestReadings(patientIds: string[]): Promise<Record<string, Reading>>;
}
