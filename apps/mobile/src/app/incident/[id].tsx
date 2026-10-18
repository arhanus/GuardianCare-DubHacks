import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { useAlerts } from "../../store";
import { Card, Heading, Screen, Action, StateCard, s, toneOf, cardTone } from "../../ui";
import { useSOS } from "../../sos";
import { useSession } from "../../session";
import { eventStatus, eventDate, isWarning } from "../../event-policy";
import { NOTE_CHIPS, escalation, waitLabel } from "../../live-policy";
import { useLive } from "../../live";
export default function Incident() {
 const { id } = useLocalSearchParams<{ id: string }>();
 const { alerts, people, respond, close, isResponding, actionError } = useAlerts();
 const { signal, playing, stopAlarm } = useSOS();
 const live = useLive();
 const caregiver = useSession().session?.role === "caregiver";
 const [note, setNote] = useState("");
 const event = alerts.find(item => item.id === id);
 if (!event) return <Screen><StateCard title="Event not found" description="This event may have been a test alarm that was already cleared." action="Go to Alerts" onAction={() => router.replace("/alerts")} /></Screen>;
 const person = people.find(item => item.id === event.personId);
 const busy = isResponding(event.id);
 const wait = escalation(event, live.now);
 // Critical events must be accepted first (that silences the alarm); warnings can be closed straight away.
 const canClose = caregiver && (event.status === "accepted" || (event.status === "received" && isWarning(event)));
 const closeWithNote = async () => {
  if (signal?.id === event.id) stopAlarm();
  if (await close(event.id, note.trim())) setNote("");
 };
 return <Screen>
  <Heading title={event.title} subtitle={`${person?.name ?? "Unknown resident"} · ${person?.room ?? ""}`} />
  <Card tone={cardTone(event)}>
   <Text accessibilityLiveRegion="polite" style={[s.badge, event.status === "received" && toneOf(event)]}>{event.severity === "warning" ? "Warning · " : ""}{eventStatus(event)}</Text>
   <Text style={s.label}>{eventDate(event)} · {event.remote ? "From the wristband" : "Test alarm"}</Text>
   {wait && <Text accessibilityLiveRegion="polite" style={[s.title, s.danger]}>Not accepted · {waitLabel(wait.waitingMs)}{wait.escalated ? " · ESCALATED" : ""}</Text>}
   <Text style={s.title}>{event.type === "Wristband" ? "Check the wristband." : "Check on this resident."}</Text>
   <Text style={s.label}>{event.description}</Text>
  </Card>
  {signal?.id === event.id && playing && !(event.remote && event.status === "received") && <Action onPress={stopAlarm} style={s.button}><Text style={s.buttonText}>Stop alarm</Text></Action>}
  {!!actionError && caregiver && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{actionError}</Text>}
  {caregiver && event.status === "received" && <Action disabled={busy} onPress={() => { if (signal?.id === event.id) stopAlarm(); respond(event.id); }} style={s.button}><Text style={s.buttonText}>{busy ? "Accepting…" : "Accept event"}</Text></Action>}
  {canClose && <Card>
   <Text style={s.title}>Close with a note</Text>
   <Text style={s.label}>Write what you found. The note is saved for the next shift and shown to family.</Text>
   <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {NOTE_CHIPS.map(chip => <Action key={chip} accessibilityState={{ selected: note === chip }} onPress={() => setNote(chip)} style={[s.choice, { flex: 0, flexGrow: 1 }, note === chip && s.choiceSelected]}><Text style={s.title}>{chip}</Text></Action>)}
   </View>
   <TextInput accessibilityLabel="Check note" value={note} onChangeText={setNote} maxLength={500} multiline placeholder="e.g. Found on the floor, helped up, no pain" placeholderTextColor="#626262" style={[s.input, { minHeight: 88, textAlignVertical: "top" }]} />
   <Action disabled={busy || !note.trim()} onPress={closeWithNote} style={[s.button, (busy || !note.trim()) && { opacity: 0.5 }]}><Text style={s.buttonText}>{busy ? "Saving…" : "Close event"}</Text></Action>
  </Card>}
  {event.status === "closed" && <Card>
   <Text style={s.badge}>Closed{event.resolvedAt ? ` · ${new Date(event.resolvedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}</Text>
   <Text style={s.title}>{event.resolutionNote || "No note was written."}</Text>
  </Card>}
  {caregiver && <Action style={s.choice} onPress={() => router.push(`/person/${event.personId}`)}><Text style={s.title}>View resident profile →</Text></Action>}
 </Screen>;
}
