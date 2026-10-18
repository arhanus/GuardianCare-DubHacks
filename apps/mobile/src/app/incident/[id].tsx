import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { useAlerts } from "../../store";
import { Card, Heading, Screen, Action, StateCard, s } from "../../ui";
import { useSOS } from "../../sos";
import { useSession } from "../../session";
import { eventStatus, eventDate } from "../../event-policy";
export default function Incident() {
 const { id } = useLocalSearchParams<{ id: string }>();
 const { alerts, people, respond, close, isResponding, actionError } = useAlerts();
 const { signal, playing, stopAlarm } = useSOS();
 const nurse = useSession().session?.role === "nurse";
 const event = alerts.find(item => item.id === id);
 if (!event) return <Screen><StateCard title="Event not found" description="This event may have been a test alarm that was already cleared." action="Go to Alerts" onAction={() => router.replace("/alerts")} /></Screen>;
 const person = people.find(item => item.id === event.personId);
 return <Screen>
  <Heading title={event.title} subtitle={`${person?.name ?? "Unknown patient"} · ${person?.room ?? ""}`} />
  <Card>
   <Text accessibilityLiveRegion="polite" style={[s.badge, event.status === "received" && s.danger]}>{eventStatus(event)}</Text>
   <Text style={s.label}>{eventDate(event)} · {event.remote ? "Live from the server" : "Test alarm"}</Text>
   <Text style={s.title}>{event.type === "SOS" || event.remote ? "Check on this person." : "Review the device connection."}</Text>
   <Text style={s.label}>{event.description}</Text>
  </Card>
  {signal?.id === event.id && playing && !(event.remote && event.status === "received") && <Action onPress={stopAlarm} style={s.button}><Text style={s.buttonText}>Stop alarm</Text></Action>}
  {nurse && event.status === "received" && <>
   {!!actionError && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{actionError}</Text>}
   <Action disabled={isResponding(event.id)} onPress={() => { if (signal?.id === event.id) stopAlarm(); respond(event.id); }} style={s.button}><Text style={s.buttonText}>{isResponding(event.id) ? "Accepting…" : "Accept event"}</Text></Action></>}
  {nurse && event.status === "accepted" && <Card>
   <Text style={s.title}>Help in progress</Text>
   <Text style={s.label}>Check the person before closing. Closing records a workflow action on this phone; it does not dispatch help.</Text>
   <Action onPress={() => { if (signal?.id === event.id) stopAlarm(); close(event.id); }} style={s.button}><Text style={s.buttonText}>Close event</Text></Action>
  </Card>}
  {event.status === "closed" && <Text style={s.badge}>Closed on this phone. Other phones still show it as in progress.</Text>}
  <Text style={s.label}>Accepting or closing an event does not contact anyone or confirm assistance.</Text>
  {nurse && <Action style={s.choice} onPress={() => router.push(`/person/${event.personId}`)}><Text style={s.title}>View patient profile →</Text></Action>}
 </Screen>;
}
