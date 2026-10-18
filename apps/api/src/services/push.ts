import type { Alert, Store } from "./store.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const BATCH = 100;

export const isExpoPushToken = (value: string) => /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(value);

type Fetch = typeof fetch;
type Logger = { error: (obj: unknown, msg?: string) => void; info: (obj: unknown, msg?: string) => void };

const DETAIL_TITLE: Record<string, string> = {
  FALL: "Possible fall",
  SUDDEN_MOTION: "Sudden movement",
  HR_HIGH: "High heart rate",
  HR_LOW: "Low heart rate",
  TEMP_HIGH: "High skin temperature",
  TEMP_LOW: "Low skin temperature",
  NOT_WORN: "Wristband not worn",
  OFFLINE: "Wristband offline",
};

export function alertTitle(alert: Pick<Alert, "type" | "detail">): string {
  if (alert.type === "SOS") return "SOS pressed";
  return (alert.detail && DETAIL_TITLE[alert.detail]) || "Care alert";
}

/**
 * Sends a push notification to every registered caregiver phone when an alert is created.
 * Failures are logged and never thrown: ingestion and the WebSocket push must not depend on Expo being reachable.
 */
export class PushService {
  constructor(
    private store: Store,
    private log: Logger,
    private send: Fetch = fetch,
  ) {}

  async notifyAlert(alert: Alert): Promise<void> {
    try {
      const tokens = await this.store.listPushTokens();
      if (!tokens.length) return;
      const patient = (await this.store.listPatients()).find((p) => p.id === alert.patientId);
      const who = patient ? `${patient.displayName}, room ${patient.roomNumber}` : "A resident";
      const urgent = alert.severity === "urgent";
      const messages = tokens.map((to) => ({
        to,
        title: `${urgent ? "🚨 " : ""}${alertTitle(alert)}`,
        body: `${who}. Needs a caregiver.`,
        sound: "default",
        priority: urgent ? "high" : "normal",
        channelId: urgent ? "alerts-critical" : "alerts",
        data: { alertId: alert.id, url: `/incident/${alert.id}` },
      }));
      for (let i = 0; i < messages.length; i += BATCH) await this.deliver(messages.slice(i, i + BATCH));
    } catch (err) {
      this.log.error({ err, alertId: alert.id }, "push notification failed");
    }
  }

  private async deliver(batch: { to: string }[]): Promise<void> {
    const res = await this.send(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      this.log.error({ status: res.status }, "Expo push service rejected the request");
      return;
    }
    const body = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    // A token whose app was uninstalled never works again: forget it.
    await Promise.all(
      (body.data ?? []).map((ticket, i) =>
        ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
          ? this.store.deletePushToken(batch[i]!.to)
          : undefined,
      ),
    );
  }
}
