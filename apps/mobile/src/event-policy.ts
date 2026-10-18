export type CareEvent = {
 id: string; personId: string; title: string; type: string; time: string;
 description: string; responding: boolean; status: "received" | "accepted" | "closed"; recordedAt?: string;
 /** Check note a caregiver wrote when closing the event, and who/when (server-side for remote events). */
 resolutionNote?: string | null; resolvedAt?: string | null; resolvedBy?: string | null;
 remote?: boolean; // true = came from the backend (real wristband/app SOS), not a local test
 /** critical = red, rings until accepted; warning = yellow, no ringing. Local test alarms are critical. */
 severity?: "critical" | "warning";
};
export function transitionEvent(event: CareEvent, action: "accept" | "close"): CareEvent {
 if (event.status === "closed" || (action === "close" && event.status !== "accepted")) return event;
 return { ...event, responding: true, status: action === "close" ? "closed" : "accepted" };
}
export const eventStatus = (event: CareEvent) => event.status === "closed" ? "Closed" : event.status === "accepted" ? "In progress" : "Needs response";
export const eventDate = (event: CareEvent) => event.recordedAt
 ? new Date(event.recordedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
 : `${event.time} · Test event`;

/** Caregivers see every event; family only sees events about the resident they follow. */
export function visibleEvents(events: CareEvent[], role: "caregiver" | "family" | undefined, residentId: string): CareEvent[] {
 return role === "caregiver" ? events : role === "family" ? events.filter(event => event.personId === residentId) : [];
}
export const isWarning = (event: CareEvent) => event.severity === "warning";
/** Events still waiting for a caregiver. */
export const needsResponse = (events: CareEvent[]) => events.filter(event => event.status === "received");
