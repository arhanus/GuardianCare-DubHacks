import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAlerts } from "../../store";
import { Card, Heading, Screen, Action, StateCard, s } from "../../ui";
import { eventStatus, eventDate } from "../../event-policy";
export default function Alerts() {
 const { alerts, nameOf } = useAlerts();
 const [filter, setFilter] = useState<"received" | "all" | "accepted">("received");
 const visible = alerts.filter(event => filter === "all" || event.status === filter);
 return <Screen>
  <Heading title="Alerts" subtitle="Review and accept alarms from the wristbands and from patients." />
  <View style={[s.row, { alignItems: "stretch" }]}>
   {(["received", "all"] as const).map(value => <Action key={value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[s.button, { flex: 1, flexBasis: 0, minWidth: 0, justifyContent: "center", paddingHorizontal: 8, opacity: filter === value ? 1 : 0.65 }]}><Text style={[s.buttonText, { textAlign: "center" }]}>{value === "received" ? "Needs response" : "All events"}{"\n"}{value === "received" ? alerts.filter(item => item.status === "received").length : alerts.length}</Text></Action>)}
  </View>
  <Action accessibilityState={{ selected: filter === "accepted" }} onPress={() => setFilter(filter === "accepted" ? "received" : "accepted")} style={[s.choice, filter === "accepted" && s.choiceSelected]}><Text style={s.title}>In progress · {alerts.filter(item => item.status === "accepted").length}</Text></Action>
  {visible.map(event => <Action key={event.id} accessibilityLabel={`Review ${event.title}, ${eventStatus(event)}`} onPress={() => router.push(`/incident/${event.id}`)}><Card>
   <View style={[s.row, { flexWrap: "wrap" }]}><Text style={[s.badge, event.status === "received" && s.danger]}>{eventStatus(event)}</Text><Text style={s.label}>{eventDate(event)}</Text></View>
   <Text style={s.title}>{event.title}</Text>
   <Text style={s.label}>{nameOf(event.personId)}</Text>
   <Text style={s.badge}>Review event →</Text>
  </Card></Action>)}
  {visible.length === 0 && <StateCard title={filter === "received" ? "No events need a response" : "No events here"} description="Your event history stays available under All events." action="View all events" onAction={() => setFilter("all")} />}
 </Screen>;
}
