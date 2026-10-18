import { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Activity, HeartPulse, Thermometer, Watch } from "lucide-react-native";
import { router } from "expo-router";
import { Action as Pressable, Card, Heading, Screen, Disclosure, colors, s, toneOf, cardTone } from "../ui";
import { useAlerts } from "../store";
import { eventDate, eventStatus, isWarning } from "../event-policy";
import { MetricChart } from "../metric-chart";
import { useLive } from "../live";
import { MAX_READINGS, pickHeartRate, pickMotion, pickTemperature, relativeTime, series } from "../live-policy";
import { FAMILY_RESIDENT_ID } from "../../constants/config";
import { useSession } from "../session";
import { SoftValue } from "../motion";

/** One line a family member can read at a glance, and its tone. */
function summary(events: ReturnType<typeof useAlerts>["alerts"], name: string) {
  const open = events.filter(event => event.status !== "closed");
  const critical = open.find(event => !isWarning(event));
  if (critical) return critical.status === "accepted"
    ? { tone: "critical" as const, title: `A caregiver is with ${name}`, text: `${critical.title}. The care team is responding.` }
    : { tone: "critical" as const, title: `${name} needs help`, text: `${critical.title}. The care team has been alerted.` };
  const warning = open[0];
  if (warning) return { tone: "warning" as const, title: "Something to watch", text: `${warning.title}. The care team can see this.` };
  return { tone: "ok" as const, title: `${name} is doing well`, text: "No open alerts." };
}

export function FamilyHome() {
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const { alerts, people } = useAlerts();
  const live = useLive();
  const resident = people.find(person => person.id === FAMILY_RESIDENT_ID);
  const name = resident?.name.split(" (")[0] ?? "Your family member";
  const status = summary(alerts, name);
  const { watch } = live;
  useEffect(() => watch(FAMILY_RESIDENT_ID), [watch]);
  const buffer = live.readings[FAMILY_RESIDENT_ID];
  const latest = buffer?.at(-1);
  const device = live.patients.find(patient => patient.id === FAMILY_RESIDENT_ID)?.device ?? null;
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
    <View style={s.row}><View style={{ flex: 1 }}><Heading title={name} subtitle={resident ? `${resident.room} · hello, ${session?.name.split(" ")[0] ?? "there"}` : `Hello, ${session?.name.split(" ")[0] ?? "there"}`} /></View><Pressable accessibilityLabel="Open your profile" onPress={() => router.push("/profile")} style={styles.profile}><Text style={s.title}>{session?.name.charAt(0).toUpperCase()}</Text></Pressable></View>
    <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={[styles.status, status.tone === "critical" && styles.statusCritical, status.tone === "warning" && styles.statusWarning]}>
      <Text style={[styles.statusTitle, status.tone === "critical" && { color: "#FFFFFF" }]}>{status.title}</Text>
      <Text style={[styles.statusText, status.tone === "critical" && { color: "#FFFFFF" }]}>{status.text}</Text>
    </View>
    <View style={s.row}><View style={{ flex: 1 }}><Text style={s.section}>Live from the wristband</Text><Text style={s.label}>{live.error ? "Server unreachable" : live.connected ? "Streaming now" : "Reconnecting…"}</Text></View></View>
    <Text style={s.label}>Last reading · {relativeTime(latest?.receivedAt, live.now)}{latest && !fresh ? " · wristband may be off or out of range" : ""}</Text>
    <View style={styles.metrics}>{metrics.map(({ label, value, unit, Icon, color }) => <View key={label} style={[styles.metric, width < 600 && styles.metricNarrow, label === "Motion" && width < 600 && styles.metricWide]}>
      <View style={{ gap: 8 }}><Icon size={22} color={color} /><Text style={[styles.metricLabel, width < 360 && { minHeight: 38 }]}>{label}</Text></View><View style={{ gap: 4 }}><SoftValue value={value} style={styles.value} /><Text style={s.label}>{unit}</Text></View>
    </View>)}</View>
    <Card><View style={s.row}><Watch color={colors.green} size={24} /><View style={{ flex: 1 }}><Text style={s.title}>Wristband · {device?.id ?? "not assigned"}</Text><Text style={s.label}>{device?.isOnline ? "Connected" : "Offline"} · last seen {relativeTime(device?.lastSeenAt, live.now)}</Text></View></View></Card>
    <Text style={s.section}>Recent events</Text>
    {alerts.slice(0, 5).map(event => <Card key={event.id} tone={cardTone(event)}>
      <View style={s.row}><Text style={s.title}>{event.title}</Text><Text style={s.label}>{eventDate(event)}</Text></View>
      <Text style={[s.badge, event.status === "received" && toneOf(event)]}>{eventStatus(event)}</Text>
      {event.status === "closed" && <Text style={s.label}>Caregiver note: {event.resolutionNote || "none"}</Text>}
    </Card>)}
    {alerts.length === 0 && <Card><Text style={s.label}>No events yet.</Text></Card>}
    <Disclosure title="Live charts">
    <Text style={s.label}>Last {MAX_READINGS} readings, about one per second. Gaps mean the sensor had no valid value.</Text>
    <MetricChart title="Heart rate" icon={HeartPulse} unit="bpm" color="#B94862" labels={hr.labels} values={hr.values} />
    <MetricChart title="Skin temperature" icon={Thermometer} unit="°C" color="#916023" labels={temp.labels} values={temp.values} />
    <MetricChart title="Motion" icon={Activity} unit="g" color={colors.green} labels={motion.labels} values={motion.values} />
    </Disclosure>
  </Screen>;
}
const styles = StyleSheet.create({
  profile: { width: 48, height: 48, backgroundColor: "#E9EFEB", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  status: { borderRadius: 20, padding: 20, gap: 6, backgroundColor: colors.greenSoft },
  statusCritical: { backgroundColor: colors.red },
  statusWarning: { backgroundColor: colors.amberSoft },
  statusTitle: { fontSize: 22, lineHeight: 29, fontWeight: "800", color: colors.ink },
  statusText: { fontSize: 16, lineHeight: 24, color: colors.ink },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexGrow: 1, flexBasis: 130, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: "white", gap: 8 },
  metricNarrow: { flexBasis: "45%", minWidth: 0, padding: 16 },
  metricWide: { flexBasis: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  metricLabel: { fontSize: 13, lineHeight: 19, color: "#626262" },
  value: { fontSize: 34, fontWeight: "800", color: colors.ink, letterSpacing: -1 },
});
