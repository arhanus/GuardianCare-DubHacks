import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Siren } from "lucide-react-native";
import { Screen, Heading, Card, Action, Disclosure, s, colors } from "../../ui";
import { useSession } from "../../session";
import { useSOS } from "../../sos";
import { useLive } from "../../live";
import { useAlerts } from "../../store";
import { eventDate, eventStatus } from "../../event-policy";
import { activeSOS } from "../../patient-policy";
import { relativeTime } from "../../live-policy";
import { DEMO_PATIENT_ID } from "../../../constants/config";

export default function SOSScreen() {
 const { session } = useSession();
 return session?.role === "patient" ? <PatientSOS /> : <NurseSOS />;
}

function NurseSOS() {
 const { people, alerts, nameOf, isResponding, actionError } = useAlerts();
 const { signal, playing, audioReady, error, simulateSOS, startAlarm, stopAlarm, acceptSignal, dismissSignal } = useSOS();
 const live = useLive();
 const [personId, setPersonId] = useState(people[0]?.id ?? "");
 const chosen = people.find(person => person.id === personId) ?? people[0];
 const event = alerts.find(item => item.id === signal?.id);
 const accepting = !!event && isResponding(event.id);
 return <Screen>
  <Heading title="SOS" subtitle="Alarms ring on this phone until a nurse accepts them." />
  {signal && event && event.status !== "closed" && <Card>
   <View style={s.row}><Siren size={28} color={colors.red} /><Text style={[s.badge, s.danger]}>{eventStatus(event)}</Text></View>
   <Text accessibilityRole="header" style={s.heading}>{nameOf(signal.personId)}</Text>
   <Text style={s.label}>{eventDate(event)} · {event.title}</Text>
   <Text style={s.label}>{event.description}</Text>
   <Text accessibilityLiveRegion="polite" style={s.title}>{playing ? "Alarm is playing" : "Alarm is stopped"}</Text>
   {!(event.remote && event.status === "received") && <Action onPress={stopAlarm} disabled={!playing} style={[s.button, { backgroundColor: colors.red }]}><Text style={s.buttonText}>Stop alarm</Text></Action>}
   {event.remote && event.status === "received" && <Text style={[s.label, s.danger]}>This alarm keeps ringing until someone accepts it.</Text>}
   {!!actionError && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{actionError}</Text>}
   {event.status === "received" ? <Action disabled={accepting} onPress={acceptSignal} style={s.button}><Text style={s.buttonText}>{accepting ? "Accepting…" : "Accept & silence alarm"}</Text></Action> : <>
    <Text style={s.label}>Help in progress. Check the patient before closing this event.</Text>
    <Action onPress={dismissSignal} style={s.button}><Text style={s.buttonText}>Close event</Text></Action>
   </>}
   {!playing && event.status === "received" && !event.remote && <Action disabled={!audioReady} onPress={startAlarm} style={s.choice}><Text style={s.title}>Play alarm again</Text></Action>}
   <Action onPress={() => router.push(`/incident/${event.id}`)} style={s.choice}><Text style={s.title}>View event details →</Text></Action>
  </Card>}
  <Card>
   <Text style={s.title}>Test the alarm</Text>
   <Text style={s.label}>Rings on this phone only. Nothing is sent to other phones.</Text>
   <Disclosure title="Choose patient for the test">
    {people.map(person => <Action key={person.id} accessibilityRole="radio" accessibilityState={{ checked: person.id === chosen?.id }} onPress={() => setPersonId(person.id)} style={[s.choice, person.id === chosen?.id && s.choiceSelected]}><Text style={s.title}>{person.name}</Text><Text style={s.label}>{person.room}</Text></Action>)}
   </Disclosure>
   <Text style={s.label}>Patient · {chosen?.name ?? "No patients loaded"}</Text>
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

function PatientSOS() {
 const { alerts } = useAlerts();
 const { error, sendSOS, sending } = useSOS();
 const live = useLive();
 const [sent, setSent] = useState(false);
 const active = activeSOS(alerts, DEMO_PATIENT_ID);
 const device = live.patients.find(patient => patient.id === DEMO_PATIENT_ID)?.device ?? null;
 return <Screen>
  <Heading title="SOS" subtitle="Ask your care team for help." />
  <Card>
   <Text style={s.title}>Need help now?</Text>
   <Text style={s.label}>Sends an SOS to every nurse. Their phones ring until one of them accepts it.</Text>
   <Action disabled={sending || !live.connected} onPress={async () => { setSent(false); setSent(await sendSOS()); }} style={[s.button, { backgroundColor: colors.red }]}><Text style={s.buttonText}>{sending ? "Sending…" : "Send SOS"}</Text></Action>
   {!live.connected && <Text style={[s.label, s.danger]}>Not connected to the server. {live.error || "Reconnecting…"}</Text>}
   {!!error && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{error}</Text>}
   {sent && !error && !active && <Text accessibilityLiveRegion="polite" style={s.title}>SOS sent.</Text>}
   {active && <Text accessibilityLiveRegion="polite" style={s.title}>{active.status === "accepted" ? "A nurse accepted your request and is on the way." : "SOS sent. Waiting for a nurse to accept."}</Text>}
  </Card>
  <Card>
   <Text style={s.title}>Your wristband</Text>
   <Text style={s.label}>{device ? `${device.id} · ${device.isOnline ? "Connected" : "Offline"} · last seen ${relativeTime(device.lastSeenAt, live.now)}` : "No wristband assigned yet"}</Text>
  </Card>
 </Screen>;
}
