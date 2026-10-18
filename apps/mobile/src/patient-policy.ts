import type { CareEvent } from "./event-policy";
export type DeviceState = "connected" | "offline" | "unassigned";
export function deviceState(person: { device: string; connected: boolean }): DeviceState {
 return !person.device || person.device === "Unassigned" ? "unassigned" : person.connected ? "connected" : "offline";
}
export function activeSOS(events: CareEvent[], id: string) {
 return events.find(event => event.personId === id && event.type === "SOS" && event.status === "received")
  ?? events.find(event => event.personId === id && event.type === "SOS" && event.status === "accepted");
}
export function patientPriority(events: CareEvent[], id: string): number {
 const sos = activeSOS(events, id);
 return sos ? sos.status === "received" ? 3 : 2 : events.some(event => event.personId === id && event.status === "received") ? 1 : 0;
}
