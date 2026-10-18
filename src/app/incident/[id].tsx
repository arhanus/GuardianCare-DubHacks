import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { useAlerts } from "../../store";
import { Card, Heading, Screen, Action, StateCard, s } from "../../ui";
import { useSession } from "../../session";
import { useSOS } from "../../sos";
import { eventStatus, eventDate } from "../../event-policy";
export default function Incident() {
 const { id } = useLocalSearchParams<{ id: string }>();
 const { alerts, people, respond, close } = useAlerts();
 const { signal, playing, stopAlarm } = useSOS();
 const { session, caredName } = useSession();
 const event = alerts.find(item => item.id === id);
 if (!event) return <Screen><StateCard title="Event not found" description="This demo event may have been cleared when the session ended." action="Go to Alerts" onAction={() => router.replace("/alerts")} /></Screen>;
 const person = ["self", "loved-one"].includes(event.personId) ? { id: event.personId, name: event.personId === "loved-one" ? caredName : session?.name ?? "You", room: "Personal bracelet" } : people.find(item => item.id === event.personId);
 return <Screen>
  <Heading title={event.title} subtitle={`${person?.name ?? "Unknown person"} · ${person?.room ?? ""}`} />
  <Card>
   <Text accessibilityLiveRegion="polite" style={[s.badge, event.status === "received" && s.danger]}>{eventStatus(event)}</Text>
   <Text style={s.label}>{eventDate(event)} · Simulated event</Text>
   <Text style={s.title}>{event.type === "SOS" ? "Check on this person." : "Review the device connection."}</Text>
   <Text style={s.label}>{event.description}</Text>
  </Card>
  {signal?.id === event.id && playing && <Action onPress={stopAlarm} style={s.button}><Text style={s.buttonText}>Stop alarm</Text></Action>}
  {event.status === "received" && <Action onPress={() => { if (signal?.id === event.id) stopAlarm(); respond(event.id); }} style={s.button}><Text style={s.buttonText}>Accept event</Text></Action>}
  {event.status === "accepted" && <Card>
   <Text style={s.title}>Help in progress</Text>
   <Text style={s.label}>Check the person before closing. Closing records a demo workflow action; it does not dispatch help.</Text>
   <Action onPress={() => { if (signal?.id === event.id) stopAlarm(); close(event.id); }} style={s.button}><Text style={s.buttonText}>Close event</Text></Action>
  </Card>}
  {event.status === "closed" && <Text style={s.badge}>Closed in this demo session.</Text>}
  <Text style={s.label}>Accepting or closing an event does not contact anyone or confirm assistance.</Text>
  <Action style={s.choice} onPress={() => router.push(["self", "loved-one"].includes(event.personId) ? "/" : `/person/${event.personId}`)}><Text style={s.title}>{["self", "loved-one"].includes(event.personId) ? "Back to personal space →" : "View patient profile →"}</Text></Action>
 </Screen>;
}
