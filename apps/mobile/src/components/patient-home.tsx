import { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Activity, HeartPulse, Thermometer, Watch } from "lucide-react-native";
import { router } from "expo-router";
import { Action as Pressable, Card, Heading, Screen, Disclosure, colors, s } from "../ui";
import { MetricChart } from "../metric-chart";
import { useLive } from "../live";
import { MAX_READINGS, pickHeartRate, pickMotion, pickTemperature, relativeTime, series } from "../live-policy";
import { DEMO_PATIENT_ID } from "../../constants/config";
import { useSession } from "../session";
import { SoftValue } from "../motion";

export function PatientHome() {
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const live = useLive();
  const { watch } = live;
  useEffect(() => watch(DEMO_PATIENT_ID), [watch]);
  const buffer = live.readings[DEMO_PATIENT_ID];
  const latest = buffer?.at(-1);
  const device = live.patients.find(patient => patient.id === DEMO_PATIENT_ID)?.device ?? null;
  const hr = series(buffer, pickHeartRate);
  const temp = series(buffer, pickTemperature);
  const motion = series(buffer, pickMotion);
  const fresh = !!latest && live.now - Date.parse(latest.receivedAt) < 15000;
  const show = (value: number | null | undefined, digits = 0) => fresh && value != null ? value.toFixed(digits) : "--";
  const metrics = [
    { label: "Heart rate", value: show(latest?.heartRateBpm), unit: "bpm", Icon: HeartPulse, color: "#B94862" },
    { label: "Skin temperature", value: show(latest?.skinTemperatureC, 1), unit: "°C", Icon: Thermometer, color: "#916023" },
    { label: "Motion", value: show(latest?.motionG, 2), unit: "g", Icon: Activity, color: colors.green },
  ];
  return <Screen>
    <View style={s.row}><View style={{ flex: 1 }}><Heading title={`Hello, ${session?.name.split(" ")[0] ?? "there"}.`} subtitle="Your wristband readings, live." /></View><Pressable accessibilityLabel="Open your profile" onPress={() => router.push("/profile")} style={styles.profile}><Text style={s.title}>{session?.name.charAt(0).toUpperCase()}</Text></Pressable></View>
    <Pressable accessibilityRole="button" onPress={() => router.push("/sos")} style={[s.button, { backgroundColor: colors.red }]}><Text style={s.buttonText}>Need help? Send SOS</Text></Pressable>
    <View style={s.row}><View style={{ flex: 1 }}><Text style={s.section}>Live from your wristband</Text><Text style={s.label}>{live.error ? "Server unreachable" : live.connected ? "Streaming now" : "Reconnecting…"}</Text></View></View>
    <Text style={s.label}>Last reading · {relativeTime(latest?.receivedAt, live.now)}{latest && !fresh ? " · wristband may be off or out of range" : ""}</Text>
    <View style={styles.metrics}>{metrics.map(({ label, value, unit, Icon, color }) => <View key={label} style={[styles.metric, width < 600 && styles.metricNarrow, label === "Motion" && width < 600 && styles.metricWide]}>
      <View style={{ gap: 8 }}><Icon size={22} color={color} /><Text style={[styles.metricLabel, width < 360 && { minHeight: 38 }]}>{label}</Text></View><View style={{ gap: 4 }}><SoftValue value={value} style={styles.value} /><Text style={s.label}>{unit}</Text></View>
    </View>)}</View>
    <Card><View style={s.row}><Watch color={colors.green} size={24} /><View style={{ flex: 1 }}><Text style={s.title}>Wristband · {device?.id ?? "not assigned"}</Text><Text style={s.label}>{device?.isOnline ? "Connected" : "Offline"} · last seen {relativeTime(device?.lastSeenAt, live.now)}</Text></View></View></Card>
    <Disclosure title="Your live charts">
    <Text style={s.label}>Last {MAX_READINGS} readings, about one per second. Gaps mean the sensor had no valid value.</Text>
    <MetricChart title="Your heart rate" icon={HeartPulse} unit="bpm" color="#B94862" labels={hr.labels} values={hr.values} />
    <MetricChart title="Your skin temperature" icon={Thermometer} unit="°C" color="#916023" labels={temp.labels} values={temp.values} />
    <MetricChart title="Your motion" icon={Activity} unit="g" color={colors.green} labels={motion.labels} values={motion.values} />
    </Disclosure>
  </Screen>;
}
const styles = StyleSheet.create({
  profile: { width: 48, height: 48, backgroundColor: "#E9EFEB", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexGrow: 1, flexBasis: 130, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: "white", gap: 8 },
  metricNarrow: { flexBasis: "45%", minWidth: 0, padding: 16 },
  metricWide: { flexBasis: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  metricLabel: { fontSize: 13, lineHeight: 19, color: "#626262" },
  value: { fontSize: 34, fontWeight: "800", color: colors.ink, letterSpacing: -1 },
});
