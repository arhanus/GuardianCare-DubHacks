import { deviceState } from "../../patient-policy";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { HeartPulse, Thermometer, Activity } from "lucide-react-native";

import { MAX_READINGS, pickHeartRate, pickMotion, pickTemperature, series } from "../../live-policy";
import { useLive } from "../../live";
import { MetricChart } from "../../metric-chart";
import { Stats10 } from "../../components/ui/stats-4";
import { Action as Pressable, Card, Heading, Screen, Disclosure, StateCard, s } from "../../ui";
import { useSession } from "../../session";
import { useAlerts } from "../../store";

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { alerts, people } = useAlerts();
  const live = useLive();
  const person = session?.role === "nurse" ? people.find((p) => p.id === id) : undefined;
  const { watch } = live;
  useEffect(() => (id ? watch(id) : undefined), [id, watch]);
  if (!person) return <Screen><StateCard title="Patient not found" description="Choose a patient from the patient list." action="Back to patients" onAction={() => router.replace("/")} /></Screen>;
  const buffer = live.readings[person.id];
  const hr = series(buffer, pickHeartRate);
  const temp = series(buffer, pickTemperature);
  const motion = series(buffer, pickMotion);
  const metrics = [
    { name: "Heart rate", values: hr.values, unit: "bpm", Icon: HeartPulse, color: "#BF5269" },
    { name: "Skin temperature", values: temp.values, unit: "°C", Icon: Thermometer, color: "#B27435" },
    { name: "Motion", values: motion.values, unit: "g", Icon: Activity, color: "#237A68" },
  ].filter(metric => metric.values.length > 0);
  return (
    <Screen>
      <Heading title={person.name} subtitle={`Patient profile · ${person.room}`} />
      <Pressable style={s.choice} onPress={() => router.push({ pathname: "/patient-editor", params: { id: person.id } })}><Text style={s.title}>Edit patient details (this phone only)</Text></Pressable>
      {alerts.filter(event => event.personId === person.id && event.status !== "closed").map(event => <Pressable key={event.id} onPress={() => router.push(`/incident/${event.id}`)}><Card><Text style={[s.title, s.danger]}>{event.title} · {event.status === "accepted" ? "Help in progress" : "Needs response"}</Text><Text style={s.label}>Review event →</Text></Card></Pressable>)}
      <Card>
        <View style={s.row}><View style={s.avatar}><Text style={s.title}>{person.initials}</Text></View><View style={{ flex: 1 }}><Text style={s.title}>{person.name}</Text><Text style={s.label}>Care team</Text></View><Text style={s.badge}>Patient</Text></View>
        <Text style={s.label}>Location · {person.room}</Text>
        <Text style={s.label}>Assigned wristband · {person.device}</Text><Text style={s.label}>Assigned caregiver · {person.caregiver || "Not assigned"}</Text>
        <Text style={s.label}>Synthetic patient. No clinical record is connected.</Text>
      </Card>
      <Card>
        <View style={s.row}>
          <Text style={s.badge}>{person.device}</Text>
          <Text style={[s.badge, deviceState(person) === "offline" && s.danger]}>
            {person.custom ? "Not assigned" : person.connected ? "Connected" : "Offline"}
          </Text>
        </View>
        <Text style={s.label}>
          {person.custom ? "No wristband assigned" : `Last reading · ${person.updated}`}
        </Text>
        {!person.custom && !person.connected && (
          <Text style={s.danger}>
            Connection lost. Readings below are stale; current measurements are
            unavailable.
          </Text>
        )}
      </Card>
      {!person.custom && <><Text style={s.section}>Latest measurements</Text>
      <Text style={s.label}>
        Live from the wristband · {live.connected ? "streaming now" : "reconnecting…"} · Mini charts show the last readings.
      </Text>
      {metrics.length ? <Stats10 metrics={metrics} stale={!person.connected} /> : <StateCard title="Waiting for live data" description="No measurements have arrived yet. Check that the wristband is on and connected to Wi-Fi." />}</>}
      {person.custom && <StateCard title="No measurements yet" description="This patient has no wristband assigned, so there are no readings." />}
      <Text style={s.section}>Patient events</Text>
      {alerts.filter(event => event.personId === person.id).map(event => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Review ${event.title} for ${person.name}`} onPress={() => router.push(`/incident/${event.id}`)}><Card><View style={s.row}><Text style={s.title}>{event.title}</Text><Text style={s.label}>{event.time}</Text></View><Text style={event.responding ? s.badge : s.danger}>{event.status === "closed" ? "Closed" : event.responding ? "In progress" : "Needs response"}</Text><Text style={s.label}>Open event →</Text></Card></Pressable>)}
      {!alerts.some(event => event.personId === person.id) && <Card><Text style={s.label}>No recorded events for this patient.</Text></Card>}
      {!person.custom && <Disclosure title="Live charts">
      <Text style={s.label}>Last {MAX_READINGS} readings, about one per second. Gaps mean the sensor had no valid value.</Text>
      <MetricChart title="Heart rate" icon={HeartPulse} unit="bpm" color="#BF5269" labels={hr.labels} values={hr.values} />
      <MetricChart title="Skin temperature" icon={Thermometer} unit="°C" color="#B27435" labels={temp.labels} values={temp.values} />
      <MetricChart title="Motion" icon={Activity} unit="g" color="#237A68" labels={motion.labels} values={motion.values} />
      </Disclosure>}
      <Text style={s.label}>
        Skin temperature is measured at the skin, not core body temperature. Live values come from a prototype
        wristband and are not a clinical measurement.
      </Text>
    </Screen>
  );
}
