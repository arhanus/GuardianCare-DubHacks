import { useState } from "react";
import { Share, Text, View } from "react-native";
import { router } from "expo-router";
import { useAlerts } from "../../store";
import { Card, Heading, Screen, Action, StateCard, s, toneOf, cardTone } from "../../ui";
import { eventStatus, eventDate } from "../../event-policy";
import { handover, handoverText } from "../../live-policy";
import { useLive } from "../../live";
import { useSession } from "../../session";
/** Last 12 hours at a glance for the shift change, with a plain-text share. */
function Handover() {
 const { alerts, nameOf } = useAlerts();
 const live = useLive();
 const { open, closed, total, critical } = handover(alerts, live.now);
 return <Card>
  <Text style={s.title}>Shift handover · last 12 hours</Text>
  <Text style={s.label}>{total} events · {critical} critical · {open.length} still open · {closed.length} closed</Text>
  {open.slice(0, 3).map(event => <Text key={event.id} style={[s.label, s.danger]}>Open · {nameOf(event.personId)}: {event.title}</Text>)}
  {closed.slice(0, 3).map(event => <Text key={event.id} style={s.label}>{nameOf(event.personId)}: {event.title}. {event.resolutionNote ?? "No note"}</Text>)}
  <Action disabled={total === 0} onPress={() => void Share.share({ message: handoverText(alerts, nameOf, live.now) })} style={s.choice}><Text style={s.title}>Share handover</Text></Action>
 </Card>;
}

export default function Alerts() {
 const { alerts, nameOf } = useAlerts();
 const family = useSession().session?.role === "family";
 const [filter, setFilter] = useState<"received" | "all" | "accepted">("received");
 const visible = alerts.filter(event => filter === "all" || event.status === filter);
 return <Screen>
  <Heading title={family ? "Events" : "Alerts"} subtitle={family ? "What happened, and what the care team did." : "Review and accept alarms from the wristbands."} />
  {!family && <Handover />}
  <View style={[s.row, { alignItems: "stretch" }]}>
   {(["received", "all"] as const).map(value => <Action key={value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[s.button, { flex: 1, flexBasis: 0, minWidth: 0, justifyContent: "center", paddingHorizontal: 8, opacity: filter === value ? 1 : 0.65 }]}><Text style={[s.buttonText, { textAlign: "center" }]}>{value === "received" ? "Needs response" : "All events"}{"\n"}{value === "received" ? alerts.filter(item => item.status === "received").length : alerts.length}</Text></Action>)}
  </View>
  <Action accessibilityState={{ selected: filter === "accepted" }} onPress={() => setFilter(filter === "accepted" ? "received" : "accepted")} style={[s.choice, filter === "accepted" && s.choiceSelected]}><Text style={s.title}>In progress · {alerts.filter(item => item.status === "accepted").length}</Text></Action>
  {visible.map(event => <Action key={event.id} accessibilityLabel={`Review ${event.title}, ${eventStatus(event)}`} onPress={() => router.push(`/incident/${event.id}`)}><Card tone={cardTone(event)}>
   <View style={[s.row, { flexWrap: "wrap" }]}><Text style={[s.badge, event.status === "received" && toneOf(event)]}>{event.severity === "warning" ? "Warning · " : ""}{eventStatus(event)}</Text><Text style={s.label}>{eventDate(event)}</Text></View>
   <Text style={s.title}>{event.title}</Text>
   <Text style={s.label}>{nameOf(event.personId)}</Text>
   {event.status === "closed" && <Text style={s.label}>Note: {event.resolutionNote || "none"}</Text>}
   <Text style={s.badge}>Review event →</Text>
  </Card></Action>)}
  {visible.length === 0 && <StateCard title={filter === "received" ? "No events need a response" : "No events here"} description="Your event history stays available under All events." action="View all events" onAction={() => setFilter("all")} />}
 </Screen>;
}
