/**
 * Shared GuardianCare contracts. TYPES ONLY - no runtime code.
 * Conventions: camelCase JSON, ISO 8601 UTC timestamps, string IDs,
 * explicit `null` for missing sensor values, string unions for statuses.
 * Changes here require sign-off from both Arhan and Aman.
 */

/** ISO 8601 UTC timestamp, e.g. "2026-10-17T12:00:00Z". */
export type IsoTimestamp = string;

export interface Patient {
  id: string;
  /** Synthetic demo data only. */
  displayName: string;
  room: string;
  deviceId: string | null;
}

export type DeviceStatus = "online" | "offline";

export interface Device {
  id: string;
  patientId: string | null;
  status: DeviceStatus;
  lastSeenAt: IsoTimestamp | null;
  firmwareVersion: string | null;
}

export interface SensorReading {
  deviceId: string;
  /** Server-validated time of measurement (see docs/ARCHITECTURE.md, timestamps). */
  timestamp: IsoTimestamp;
  /** Beats per minute; null = sensor unavailable/invalid. */
  heartRateBpm: number | null;
  /** Motion magnitude in g; null = unavailable. */
  motionG: number | null;
  /** Optional TMP117 reading, Celsius. */
  temperatureC?: number | null;
}

export type DeviceEventType = "SOS" | "HEART_RATE_ALERT" | "HEARTBEAT";

export interface DeviceEvent {
  /** Unique per event, device-generated; used for idempotent retries. */
  eventId: string;
  deviceId: string;
  eventType: DeviceEventType;
  /** Device-reported time; backend also records its own receivedAt. */
  timestamp: IsoTimestamp;
}

export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  patientId: string;
  deviceId: string;
  /** Source event type. */
  type: Exclude<DeviceEventType, "HEARTBEAT">;
  status: AlertStatus;
  createdAt: IsoTimestamp;
  acknowledgedAt: IsoTimestamp | null;
  acknowledgedBy: string | null;
}

export interface AcknowledgeAlertRequest {
  /** Nurse identifier (demo: free-form name or user id). */
  acknowledgedBy: string;
}

export interface HealthResponse {
  status: "ok";
  service: "guardiancare-api";
}
