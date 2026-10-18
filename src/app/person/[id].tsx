import { deviceState } from "../../patient-policy";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { HeartPulse, Thermometer, Activity } from "lucide-react-native";

import { getReadings, type Period } from "../../metrics";
import { MetricChart } from "../../metric-chart";
import { Stats10 } from "../../components/ui/stats-4";
import { Action as Pressable, Card, Heading, Screen, Disclosure, StateCard, s } from "../../ui";
import { useSession } from "../../session";
import { useAlerts } from "../../store";

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<Period>("24h");
  const { session, recipients } = useSession();
  const { alerts, people } = useAlerts();
  const person = session?.type === "organization" ? people.find((p) => p.id === id) : undefined;
  if (!person) return <Screen><StateCard title="Patient not found" description="Choose a patient from your organization's demo directory." action="Back to patients" onAction={() => router.replace("/")} /></Screen>;
  const recipient = recipients.find(item => item.id === person.recipientId);
  const readings = getReadings(person.id, period);
  const latestReadings = getReadings(person.id, "24h");
  const labels = readings.map((r) => r.label);
  const metrics = [
    {
      name: "Heart rate",
      values: latestReadings.map((reading) => reading.heartRate),
      unit: "bpm",
      Icon: HeartPulse,
      color: "#BF5269",
    },
    {
      name: "Skin temperature",
      values: latestReadings.map((reading) => reading.skinTemperature),
      unit: "°C",
      Icon: Thermometer,
      color: "#B27435",
    },
    {
      name: "Movement",
      values: latestReadings.map((reading) => reading.movement),
      unit: "min / 2h",
      Icon: Activity,
      color: "#237A68",
    },
  ];
  return (
    <Screen>
      <Heading title={person.name} subtitle={`Patient profile · ${person.room}`} />
      <Pressable style={s.choice} onPress={() => router.push({ pathname: "/patient-editor", params: { id: person.id } })}><Text style={s.title}>Edit demo patient</Text></Pressable>
      {alerts.filter(event => event.personId === person.id && event.status !== "closed").map(event => <Pressable key={event.id} onPress={() => router.push(`/incident/${event.id}`)}><Card><Text style={[s.title, s.danger]}>{event.title} · {event.status === "accepted" ? "Help in progress" : "Needs response"}</Text><Text style={s.label}>Review event →</Text></Card></Pressable>)}
      <Card>
        <View style={s.row}><View style={s.avatar}><Text style={s.title}>{person.initials}</Text></View><View style={{ flex: 1 }}><Text style={s.title}>{person.name}</Text><Text style={s.label}>{session?.organization ?? "Care team"}</Text></View><Text style={s.badge}>Patient</Text></View>
        <Text style={s.label}>Patient ID · GC-{person.id.toUpperCase()}</Text>
        <Text style={s.label}>Location · {person.room}</Text>
        <Text style={s.label}>Assigned bracelet · {person.device}</Text><Text style={s.label}>Assigned caregiver · {person.caregiver || "Not assigned"}</Text><Text style={s.label}>SOS recipient · {recipient?.name ?? "Not assigned"} · {recipient?.paired ? "Demo paired" : "Not paired"}</Text>
        <Text style={s.label}>Care record · Fictional demo profile. No clinical record connected.</Text>
      </Card>
      <Card>
        <View style={s.row}>
          <Text style={s.badge}>{person.device}</Text>
          <Text style={[s.badge, deviceState(person) === "offline" && s.danger]}>
            {person.custom ? "Not assigned" : person.connected ? "Demo connected" : "Demo offline"}
          </Text>
        </View>
        <Text style={s.label}>
          {person.custom ? "No bracelet assigned" : `Sample received · ${person.updated} · Battery ${person.battery}%`}
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
        Latest two-hour sample · Mini charts show the last 24 hours.
      </Text>
      <Stats10 metrics={metrics} stale={!person.connected} /></>}
      {person.custom && <StateCard title="No measurements yet" description="This new demo profile has no device or sample readings. Assign hardware when real pairing is available." />}
      <Text style={s.section}>Patient events</Text>
      {alerts.filter(event => event.personId === person.id).map(event => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Review ${event.title} for ${person.name}`} onPress={() => router.push(`/incident/${event.id}`)}><Card><View style={s.row}><Text style={s.title}>{event.title}</Text><Text style={s.label}>{event.time}</Text></View><Text style={event.responding ? s.badge : s.danger}>{event.status === "closed" ? "Closed" : event.responding ? "In progress" : "Needs response"}</Text><Text style={s.label}>Open event →</Text></Card></Pressable>)}
      {!alerts.some(event => event.personId === person.id) && <Card><Text style={s.label}>No recorded events for this patient.</Text></Card>}
      {!person.custom && <Disclosure title="Patient statistics"><View style={[s.row, { flexWrap: "wrap" }]}>
        <Text style={s.section}>Patient statistics</Text>
        <View style={styles.periods}>
          {(["24h", "7d"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Show ${value} statistics`}
              accessibilityState={{ selected: period === value }}
              onPress={() => setPeriod(value)}
              style={[styles.period, period === value && styles.periodSelected]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.periodText,
                  period === value && styles.periodTextSelected,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={s.label}>
        Historical demo data ·{" "}
        {period === "24h"
          ? "Two-hour samples, ending Sunday 08:00"
          : "Daily summaries, Monday–Sunday"}
        . Movement shows active minutes per{" "}
        {period === "24h" ? "two-hour interval" : "day"}.
      </Text>
      <MetricChart
        title="Heart rate"
        icon={HeartPulse}
        unit="bpm"
        color="#BF5269"
        labels={labels}
        values={readings.map((r) => r.heartRate)}
      />
      <MetricChart
        title="Skin temperature"
        icon={Thermometer}
        unit="°C"
        color="#B27435"
        labels={labels}
        values={readings.map((r) => r.skinTemperature)}
      />
      <MetricChart
        title="Movement activity"
        icon={Activity}
        unit="min"
        color="#237A68"
        bars
        labels={labels}
        values={readings.map((r) => r.movement)}
      />
      </Disclosure>}
      <Text style={s.label}>
        Skin temperature is measured at the skin, not core body temperature. All
        measurements shown here are simulated.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  periods: {
    flexDirection: "row",
    flexShrink: 0,
    alignItems: "center",
    padding: 4,
    gap: 4,
    borderRadius: 14,
    backgroundColor: "#E6EEEA",
  },
  period: {
    minWidth: 60,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  periodSelected: { backgroundColor: "#237A68" },
  periodText: { color: "#47665F", fontSize: 14, fontWeight: "700" },
  periodTextSelected: { color: "#FFFFFF" },
});
