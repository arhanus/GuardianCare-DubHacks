import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Siren } from "lucide-react-native";
import { Screen, Heading, Card, Action, Disclosure, s, colors } from "../../ui";
import { useSession } from "../../session";
import { useSOS } from "../../sos";
import { useAlerts } from "../../store";
import { eventDate, eventStatus } from "../../event-policy";
import { RecipientSetup } from "../../components/recipient-setup";
export default function SOSScreen() {
 const { session, personalRole, caredName, trustedName, demoPaired, recipients } = useSession();
 const { people, alerts } = useAlerts();
 const { signal, playing, audioReady, error, simulateSOS, startAlarm, stopAlarm, acceptSignal, dismissSignal } = useSOS();
 const organization = session?.type === "organization";
 const [personId, setPersonId] = useState(people[0]?.id ?? "");
 const selectedPatient = people.find(person => person.id === (signal?.personId && alerts.some(item => item.id === signal.id && item.status !== "closed") ? signal.personId : personId));
 const recipient = organization ? recipients.find(item => item.id === selectedPatient?.recipientId) : undefined;
 const recipientLabel = organization ? recipient ? `${recipient.name} · ${recipient.paired ? "Demo paired" : "Not paired"}` : "Not assigned" : demoPaired ? `${trustedName} (demo)` : "Not paired";
 const event = alerts.find(item => item.id === signal?.id);
 const personName = signal?.personId === "loved-one" ? caredName : signal?.personId === "self" ? session?.name : people.find(person => person.id === signal?.personId)?.name;
 return <Screen>
  <Heading title="SOS" subtitle={organization ? "Alerts for your care team." : personalRole === "trusted" ? `Helping ${caredName}.` : "Your trusted person and assistance events."} />
  {signal && event && event.status !== "closed" && <Card>
   <View style={s.row}><Siren size={28} color={colors.red} /><Text style={[s.badge, s.danger]}>{eventStatus(event)}</Text></View>
   <Text accessibilityRole="header" style={s.heading}>{personName}</Text>
   <Text style={s.label}>{eventDate(event)} · Test SOS</Text>
   <Text style={s.label}>Recipient · {recipientLabel}</Text>
   <Text accessibilityLiveRegion="polite" style={s.title}>{playing ? "Alarm is playing" : "Alarm is stopped"}</Text>
   <Action onPress={stopAlarm} disabled={!playing} style={[s.button, { backgroundColor: colors.red }]}><Text style={s.buttonText}>Stop alarm</Text></Action>
   {event.status === "received" ? <Action onPress={acceptSignal} style={s.button}><Text style={s.buttonText}>Accept event & silence alarm</Text></Action> : <>
    <Text style={s.label}>Help in progress. Check the person before closing this demo event.</Text>
    <Action onPress={dismissSignal} style={s.button}><Text style={s.buttonText}>Close event</Text></Action>
   </>}
   {!playing && event.status === "received" && <Action disabled={!audioReady} onPress={startAlarm} style={s.choice}><Text style={s.title}>Play alarm again</Text></Action>}
   <Action onPress={() => router.push(`/incident/${event.id}`)} style={s.choice}><Text style={s.title}>View event details →</Text></Action>
  </Card>}
  <Card>
   <Text style={s.title}>{organization ? "Nurse alarm preview" : "Trusted person alarm preview"}</Text>
   <Text style={s.label}>Test on this phone only. No remote alert is sent.</Text>
   {organization && <Disclosure title="Choose patient for test">
    {people.map(person => <Action key={person.id} accessibilityRole="radio" accessibilityState={{ checked: person.id === personId }} onPress={() => setPersonId(person.id)} style={[s.choice, person.id === personId && s.choiceSelected]}><Text style={s.title}>{person.name}</Text><Text style={s.label}>{person.room}</Text></Action>)}
   </Disclosure>}
   {organization && <Text style={s.label}>Patient · {people.find(person => person.id === personId)?.name ?? "Choose a patient"}</Text>}
   <Text style={s.label}>Recipient · {recipientLabel}</Text>
   <Action disabled={!!event && event.status !== "closed" || !audioReady || organization && !personId} onPress={() => simulateSOS(organization ? personId : personalRole === "trusted" ? "loved-one" : "self")} style={s.button}><Text style={s.buttonText}>{event && event.status !== "closed" ? "Finish current test first" : audioReady ? "Test SOS alarm" : "Preparing audio…"}</Text></Action>
   {!!error && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{error}</Text>}
   <Text style={s.label}>Uses your volume and audio output while the app is open.</Text>
  </Card>
  <Disclosure title="SOS setup & connection">
   <Text style={s.label}>Bracelet · Not connected</Text>
   <Text style={s.label}>Selected patient recipient · {recipientLabel}</Text>
   <Text style={s.label}>Internet delivery · Not configured</Text>
   <RecipientSetup />
   <Text style={s.label}>Bluetooth hardware, remote delivery, bracelet vibration and background alerts are not connected.</Text>
  </Disclosure>
 </Screen>;
}
