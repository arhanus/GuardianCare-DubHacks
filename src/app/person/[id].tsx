import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HeartPulse, Thermometer, Activity } from "lucide-react-native";
import { people } from "../../data";
import { getReadings, type Period } from "../../metrics";
import { MetricChart } from "../../metric-chart";
import { Stats10 } from "../../components/ui/stats-4";
import { Card, Heading, Screen, s } from "../../ui";

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<Period>("24h");
  const person = people.find((p) => p.id === id);
  if (!person)
    return (
      <Screen>
        <Heading
          title="Person not found"
          subtitle="Return to People to choose a demo profile."
        />
      </Screen>
    );
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
      <Heading title={person.name} subtitle={person.room} />
      <Card>
        <View style={s.row}>
          <Text style={s.badge}>{person.device}</Text>
          <Text style={[s.badge, !person.connected && s.danger]}>
            {person.connected ? "● Connected" : "○ Offline"}
          </Text>
        </View>
        <Text style={s.label}>
          Last received · {person.updated} · Battery {person.battery}%
        </Text>
        {!person.connected && (
          <Text style={s.danger}>
            Connection lost. Readings below are stale; current measurements are
            unavailable.
          </Text>
        )}
      </Card>
      <Text style={s.section}>Latest measurements</Text>
      <Text style={s.label}>
        Latest two-hour sample · Mini charts show the last 24 hours.
      </Text>
      <Stats10 metrics={metrics} stale={!person.connected} />
      <View style={[s.row, { flexWrap: "wrap" }]}>
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
