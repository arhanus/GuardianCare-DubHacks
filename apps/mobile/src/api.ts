import type { Alert, LiveReading } from "@guardiancare/contracts";
import { getApiUrl } from "./server-url";

export type ApiPatient = {
  id: string;
  displayName: string;
  roomNumber: string;
  device: { id: string; lastSeenAt: string | null; isOnline: boolean } | null;
  latestReading: LiveReading | null;
  activeAlertCount: number;
};

/** Non-2xx answer from the API; `status` lets callers show a specific message. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${getApiUrl()}${path}`, { ...init, signal: controller.signal, headers: { "content-type": "application/json", ...init?.headers } });
    if (!res.ok) throw new ApiError(res.status, (await res.text().catch(() => "")).slice(0, 120));
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const getPatients = () => request<ApiPatient[]>("/api/patients");
export const getAlerts = () => request<Alert[]>("/api/alerts?status=all&limit=200");
export const getReadings = (patientId: string, limit = 60) => request<LiveReading[]>(`/api/patients/${patientId}/readings?limit=${limit}`);
export const acknowledgeAlert = (alertId: string) => request<Alert>(`/api/alerts/${alertId}/acknowledge`, { method: "PATCH", body: "{}" });
export const resolveAlert = (alertId: string, note: string) => request<Alert>(`/api/alerts/${alertId}/resolve`, { method: "PATCH", body: JSON.stringify({ note }) });
export const sendSOS = (patientId: string, eventId: string) => request<{ alert: Alert; duplicate: boolean }>(`/api/patients/${patientId}/sos`, { method: "POST", body: JSON.stringify({ eventId }) });

/** ws:// (or wss://) URL of the live stream, derived from the API base URL. */
export const liveUrl = () => `${getApiUrl().replace(/^http/, "ws")}/api/live`;
