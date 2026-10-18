import React, { createContext, useContext, useMemo, useState } from "react";
import { useSession } from "./session";
import { useLive } from "./live";
import { ApiError } from "./api";
import { DEMO_PATIENT_ID } from "../constants/config";
import { transitionEvent, visibleEvents, type CareEvent } from "./event-policy";
import { movementLabel, readingAt, relativeTime, toCareEvent } from "./live-policy";
export type Patient = {
 id: string; name: string; initials: string; room: string;
 device: string; connected: boolean; updated: string; motion: string;
 caregiver: string; custom?: boolean;
};
const AlertContext = createContext<{
 alerts: CareEvent[]; people: Patient[];
 nameOf: (personId: string) => string;
 savePatient: (patient: Patient) => void;
 respond: (id: string) => void; close: (id: string) => void;
 /** True while an acknowledge request for this event is in flight. */
 isResponding: (id: string) => boolean;
 addTest: (id: string, personId: string) => void;
 actionError: string;
} | null>(null);
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join("").toUpperCase();
export function AlertProvider({ children }: { children: React.ReactNode }) {
 const { session } = useSession();
 const live = useLive();
 // Local-only state: edits/extra patients, test alarms, and events closed on this phone.
 const [edits, setEdits] = useState<Record<string, Patient>>({});
 const [custom, setCustom] = useState<Patient[]>([]);
 const [closedIds, setClosedIds] = useState<Set<string>>(() => new Set());
 const [pending, setPending] = useState<Set<string>>(() => new Set());
 const [actionError, setActionError] = useState("");
 const [tests, setTests] = useState<CareEvent[]>([]);

 // Patients come from the backend. Device/connection/last-update always reflect live data.
 const people = useMemo<Patient[]>(() => {
  const fromLive = live.patients.map(patient => {
   const latest = live.readings[patient.id]?.at(-1) ?? patient.latestReading;
   const base: Patient = {
    id: patient.id, name: patient.displayName, initials: initials(patient.displayName), room: `Room ${patient.roomNumber}`,
    device: patient.device?.id ?? "Unassigned", connected: patient.device?.isOnline ?? false,
    updated: relativeTime(patient.device?.lastSeenAt ?? latest?.receivedAt, live.now), motion: movementLabel(latest),
    caregiver: "", custom: !patient.device,
   };
   const edit = edits[patient.id];
   return edit ? { ...edit, device: base.device, connected: base.connected, updated: base.updated, motion: base.motion, custom: base.custom } : base;
  });
  return [...fromLive, ...custom];
 }, [live.patients, live.readings, live.now, edits, custom]);

 // Backend alerts become events. "Closed" is a per-phone state: the server only knows open/acknowledged.
 const remote = useMemo<CareEvent[]>(() => live.alerts.map(alert => {
  const event = toCareEvent(alert, alert.patientId, readingAt(live.readings[alert.patientId], alert.createdAt));
  return closedIds.has(event.id) && event.status === "accepted" ? { ...event, status: "closed" as const } : event;
 }), [live.alerts, live.readings, closedIds]);

 const all = useMemo(() => [...remote, ...tests], [remote, tests]);
 const isRemote = (id: string) => remote.some(event => event.id === id);
 const nameOf = (personId: string) => people.find(person => person.id === personId)?.name ?? "Unknown patient";
 return <AlertContext.Provider value={{ alerts: visibleEvents(all, session?.role, DEMO_PATIENT_ID), people, actionError, nameOf,
  isResponding: id => pending.has(id),
  savePatient: patient => {
   if (live.patients.some(item => item.id === patient.id)) setEdits(items => ({ ...items, [patient.id]: patient }));
   else setCustom(items => items.some(item => item.id === patient.id) ? items.map(item => item.id === patient.id ? patient : item) : [...items, patient]);
  },
  addTest: (id, personId) => setTests(items => items.some(item => item.id === id) ? items : [{
   id, personId, title: "Test alarm", type: "SOS", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), recordedAt: new Date().toISOString(),
   description: "A test alarm on this phone only. No other phone was notified.", responding: false, status: "received",
  }, ...items]),
  // Remote events are acknowledged on the server so every phone stops ringing.
  respond: id => {
   if (isRemote(id)) {
    if (pending.has(id)) return;
    setActionError(""); setPending(ids => new Set(ids).add(id));
    live.acknowledge(id)
     .catch(err => setActionError(err instanceof ApiError && err.status === 404 ? "This alert no longer exists on the server." : "Could not reach the server to accept this alert. The alarm keeps ringing until it succeeds."))
     .finally(() => setPending(ids => { const next = new Set(ids); next.delete(id); return next; }));
    return;
   }
   setTests(items => items.map(item => item.id === id ? transitionEvent(item, "accept") : item));
  },
  close: id => {
   if (isRemote(id)) { setClosedIds(ids => new Set(ids).add(id)); return; }
   setTests(items => items.map(item => item.id === id ? transitionEvent(item, "close") : item));
  },
 }}>{children}</AlertContext.Provider>;
}
export function useAlerts() {
 const value = useContext(AlertContext);
 if (!value) throw new Error("AlertProvider is required");
 return value;
}
