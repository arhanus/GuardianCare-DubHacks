import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Siren } from "lucide-react-native";
import { Screen, Heading, Card, Action, Disclosure, s, colors } from "../../ui";
import { useSOS } from "../../sos";
import { useLive } from "../../live";
import { useAlerts } from "../../store";
import { eventDate, eventStatus } from "../../event-policy";
import { escalation, waitLabel } from "../../live-policy";

/** Caregiver alarm screen: the ringing alarm, and a test. (Family has no alarm tab.) */
export default function AlarmScreen() {
 const { people, alerts, nameOf, isResponding, actionError } = useAlerts();
 const { signal, playing, audioReady, error, simulateSOS, startAlarm, stopAlarm, acceptSignal } = useSOS();
 const live = useLive();
 const [personId, setPersonId] = useState(people[0]?.id ?? "");
 const chosen = people.find(person => person.id === personId) ?? people[0];
 const event = alerts.find(item => item.id === signal?.id);
 const accepting = !!event && isResponding(event.id);
 const wait = event ? escalation(event, live.now) : null;
 return <Screen>
  <Heading title="Alarm" subtitle="Critical alarms ring on this phone until a caregiver accepts them." />
  {signal && event && event.status !== "closed" && <Card>
   <View style={s.row}><Siren size={28} color={colors.red} /><Text style={[s.badge, s.danger]}>{eventStatus(event)}</Text></View>
   <Text accessibilityRole="header" style={s.heading}>{nameOf(signal.personId)}</Text>
   <Text style={s.label}>{eventDate(event)} · {event.title}</Text>
   <Text style={s.label}>{event.description}</Text>
   {wait && <Text accessibilityLiveRegion="polite" style={[s.title, s.danger]}>Not accepted · {waitLabel(wait.waitingMs)}{wait.escalated ? " · ESCALATED" : ""}</Text>}
   <Text accessibilityLiveRegion="polite" style={s.title}>{playing ? "Alarm is playing" : "Alarm is stopped"}</Text>
   {!(event.remote && event.status === "received") && <Action onPress={stopAlarm} disabled={!playing} style={[s.button, { backgroundColor: colors.red }]}><Text style={s.buttonText}>Stop alarm</Text></Action>}
   {event.remote && event.status === "received" && <Text style={[s.label, s.danger]}>This alarm keeps ringing until someone accepts it.</Text>}
   {!!actionError && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{actionError}</Text>}
   {event.status === "received" ? <Action disabled={accepting} onPress={acceptSignal} style={s.button}><Text style={s.buttonText}>{accepting ? "Accepting…" : "Accept & silence alarm"}</Text></Action> : <>
    <Text style={s.label}>Help in progress. Check on the resident, then close the event with a note.</Text>
    <Action onPress={() => router.push(`/incident/${event.id}`)} style={s.button}><Text style={s.buttonText}>Close with note</Text></Action>
   </>}
   {!playing && event.status === "received" && !event.remote && <Action disabled={!audioReady} onPress={startAlarm} style={s.choice}><Text style={s.title}>Play alarm again</Text></Action>}
   <Action onPress={() => router.push(`/incident/${event.id}`)} style={s.choice}><Text style={s.title}>View event details →</Text></Action>
  </Card>}
  <Card>
   <Text style={s.title}>Test the alarm</Text>
   <Text style={s.label}>Rings on this phone only. Nothing is sent to other phones.</Text>
   <Disclosure title="Choose resident for the test">
    {people.map(person => <Action key={person.id} accessibilityRole="radio" accessibilityState={{ checked: person.id === chosen?.id }} onPress={() => setPersonId(person.id)} style={[s.choice, person.id === chosen?.id && s.choiceSelected]}><Text style={s.title}>{person.name}</Text><Text style={s.label}>{person.room}</Text></Action>)}
   </Disclosure>
   <Text style={s.label}>Resident · {chosen?.name ?? "No residents loaded"}</Text>
   <Action disabled={!!event && event.status !== "closed" || !audioReady || !chosen} onPress={() => chosen && simulateSOS(chosen.id)} style={s.button}><Text style={s.buttonText}>{event && event.status !== "closed" ? "Finish the current alarm first" : audioReady ? "Test alarm" : "Preparing audio…"}</Text></Action>
   {!!error && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{error}</Text>}
   <Text style={s.label}>Uses your volume and audio output while the app is open.</Text>
  </Card>
  <Card>
   <Text style={s.title}>Connection</Text>
   <Text style={s.label}>Live alerts · {live.connected ? "Connected" : "Not connected"}</Text>
   <Text style={s.label}>Alarms ring while the app is open. Background and locked-screen alerts need a development build.</Text>
  </Card>
 </Screen>;
}
