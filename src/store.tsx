import React, { createContext, useContext, useState } from "react";
import { initialAlerts, people as samplePeople } from "./data";
import { useSession } from "./session";
import { transitionEvent, visibleEvents, type CareEvent } from "./event-policy";
export type Patient = typeof samplePeople[number] & { caregiver: string; recipientId: string; custom?: boolean };
const AlertContext = createContext<{
 alerts: CareEvent[]; people: Patient[];
 savePatient: (patient: Patient) => void;
 respond: (id: string) => void; close: (id: string) => void;
 addSOS: (id: string, personId: string, simulation: boolean) => void;
} | null>(null);
export function AlertProvider({ children }: { children: React.ReactNode }) {
 const { session, personalRole } = useSession();
 const [people, setPeople] = useState<Patient[]>(() => samplePeople.map(person => ({ ...person, caregiver: "Demo nurse", recipientId: "care-team" })));
 const [alerts, setAlerts] = useState<CareEvent[]>(() => (session?.type === "personal" ? [{
  id: "self-device", personId: "self", title: "Bracelet reconnected", type: "Device", time: "09:42",
  description: "A simulated device event. No physical bracelet is connected.", responding: true,
 }] : initialAlerts).map(event => ({ ...event, status: event.responding ? "accepted" : "received" })));
 return <AlertContext.Provider value={{ alerts: visibleEvents(alerts, session?.type, personalRole), people,
  savePatient: patient => setPeople(items => items.some(item => item.id === patient.id) ? items.map(item => item.id === patient.id ? patient : item) : [...items, patient]),
  addSOS: (id, personId, simulation) => setAlerts(items => items.some(item => item.id === id) ? items : [{
   id, personId, title: simulation ? "Test SOS received" : "SOS received", type: "SOS", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), recordedAt: new Date().toISOString(),
   description: simulation ? "A test alarm on this phone only. No remote recipient was notified." : "An SOS signal was received. Check the person.", responding: false, status: "received",
  }, ...items]),
  respond: id => setAlerts(items => items.map(item => item.id === id ? transitionEvent(item, "accept") : item)),
  close: id => setAlerts(items => items.map(item => item.id === id ? transitionEvent(item, "close") : item)),
 }}>{children}</AlertContext.Provider>;
}
export function useAlerts() {
 const value = useContext(AlertContext);
 if (!value) throw new Error("AlertProvider is required");
 return value;
}
