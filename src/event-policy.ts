export type CareEvent = {
 id: string; personId: string; title: string; type: string; time: string;
 description: string; responding: boolean; status: "received" | "accepted" | "closed"; recordedAt?: string;
};
export function transitionEvent(event: CareEvent, action: "accept" | "close"): CareEvent {
 if (event.status === "closed" || (action === "close" && event.status !== "accepted")) return event;
 return { ...event, responding: true, status: action === "close" ? "closed" : "accepted" };
}
export const eventStatus = (event: CareEvent) => event.status === "closed" ? "Closed" : event.status === "accepted" ? "In progress" : "Needs response";
export const eventDate = (event: CareEvent) => event.recordedAt
 ? new Date(event.recordedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
 : `${event.time} · Sample event`;

export function visibleEvents(events: CareEvent[], account: "personal" | "organization" | undefined, role: "owner" | "trusted"): CareEvent[] {
 return account === "personal" ? events.filter(event => event.personId === (role === "trusted" ? "loved-one" : "self")) : account === "organization" ? events : [];
}
