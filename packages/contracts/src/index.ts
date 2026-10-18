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

export type AlertType = "SOS" | "HEART_RATE_ALERT" | "MOTION_ALERT" | "TEMPERATURE_ALERT" | "DEVICE_ALERT";
export type AlertDetail = "HR_HIGH" | "HR_LOW" | "SUDDEN_MOTION" | "FALL" | "TEMP_HIGH" | "TEMP_LOW" | "NOT_WORN" | "OFFLINE";

export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  patientId: string;
  deviceId: string;
  /** Source event type. */
  type: AlertType;
  /** Which rule tripped, for sensor alerts; null for SOS. */
  detail?: AlertDetail | null;
  /** "urgent" = critical: red, the nurse app rings until acknowledged. "warning" = yellow, no ringing. */
  severity?: "urgent" | "warning";
  /** "app" = SOS pressed in the mobile app. */
  source?: "device" | "simulation" | "app";
  status: AlertStatus;
  createdAt: IsoTimestamp;
  acknowledgedAt: IsoTimestamp | null;
  acknowledgedBy: string | null;
  /** Set when a caregiver closes the event with a note (PATCH /api/alerts/:id/resolve). */
  resolvedAt?: IsoTimestamp | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
}

export interface ResolveAlertRequest {
  /** What the caregiver found/did, 1-500 characters. */
  note: string;
}

export interface AcknowledgeAlertRequest {
  /** Nurse identifier (demo: free-form name or user id). */
  acknowledgedBy: string;
}

export interface HealthResponse {
  status: "ok";
  service: "guardiancare-api";
}

/** Stored reading as returned by the API (and pushed over /api/live). */
export interface LiveReading {
  id: string;
  deviceId: string;
  patientId: string;
  heartRateBpm: number | null;
  skinTemperatureC: number | null;
  accelerationG: { x: number; y: number; z: number } | null;
  /** sqrt(x^2 + y^2 + z^2); null when acceleration is unavailable. */
  motionG: number | null;
  signalQuality: "good" | "poor" | "unknown";
  receivedAt: IsoTimestamp;
}

/** WebSocket messages from GET /api/live. */
export type LiveMessage =
  | { type: "hello"; serverTime: IsoTimestamp }
  | { type: "ping" }
  | { type: "reading"; patientId: string; reading: LiveReading }
  | { type: "alert"; alert: Alert }
  | { type: "alert_updated"; alert: Alert };
