export type CareEvent = {
 id: string; personId: string; title: string; type: string; time: string;
 description: string; responding: boolean; status: "received" | "accepted" | "closed"; recordedAt?: string;
 remote?: boolean; // true = came from the backend (real wristband/app SOS), not a local test
};
export function transitionEvent(event: CareEvent, action: "accept" | "close"): CareEvent {
 if (event.status === "closed" || (action === "close" && event.status !== "accepted")) return event;
 return { ...event, responding: true, status: action === "close" ? "closed" : "accepted" };
}
export const eventStatus = (event: CareEvent) => event.status === "closed" ? "Closed" : event.status === "accepted" ? "In progress" : "Needs response";
export const eventDate = (event: CareEvent) => event.recordedAt
 ? new Date(event.recordedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
 : `${event.time} · Test event`;

/** Nurses see every event; a patient only sees events about their own wristband. */
export function visibleEvents(events: CareEvent[], role: "nurse" | "patient" | undefined, ownPatientId: string): CareEvent[] {
 return role === "nurse" ? events : role === "patient" ? events.filter(event => event.personId === ownPatientId) : [];
}
/** Events still waiting for a nurse. */
export const needsResponse = (events: CareEvent[]) => events.filter(event => event.status === "received");
