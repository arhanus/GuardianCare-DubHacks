import { PersonalRoleSwitch } from "./personal-role-switch";
import { useAlerts } from "../store";
import { useCallback, useState } from "react";
import { AppState, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Activity, HeartPulse, Thermometer, Watch, ArrowUpRight } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { Action as Pressable, Card, Heading, Screen, Disclosure, StateCard, colors, s } from "../ui";
import { MetricChart } from "../metric-chart";
import { getReadings, type Period } from "../metrics";
import { useSession } from "../session";
import { SoftValue } from "../motion";

export function PersonalHome() {
  const { width } = useWindowDimensions();
  const { session, personalRole, caredName, demoPaired, trustedName } = useSession();
  const { alerts } = useAlerts();
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(0);
  const [period, setPeriod] = useState<Period>("24h");
  useFocusEffect(useCallback(() => {
    if (!running || personalRole !== "owner") return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") { setTick(value => value + 1); setLastUpdate(new Date()); }
    }, 5000);
    return () => clearInterval(timer);
  }, [running, personalRole]));
  const readings = getReadings("self", period);
  const pulse = 70 + [0, 2, 1, -1, 3, 0][tick % 6];
  const temp = (33.6 + [0, 0.1, 0.2, 0.1, 0, -0.1][tick % 6]).toFixed(1);
  const metrics = [
    { label: "Heart rate", value: String(pulse), unit: "bpm", Icon: HeartPulse, color: "#B94862" },
    { label: "Skin temperature", value: temp, unit: "°C", Icon: Thermometer, color: "#916023" },
    { label: "Movement", value: String(8 + tick % 7), unit: "min / 2h", Icon: Activity, color: colors.green },
  ];
  if (personalRole === "trusted") return <Screen>
    <Heading title="Your care circle" subtitle="You are viewing the trusted person preview." />
    <PersonalRoleSwitch />
    <Card><Text style={s.title}>{caredName}</Text><Text style={s.badge}>Trusted person preview</Text><Text style={s.label}>No live readings or remote connection.</Text><Pressable onPress={() => router.push("/settings/devices")} style={s.choice}><Text style={s.title}>Manage people & devices →</Text></Pressable></Card>
    <Card><Text style={s.title}>Assistance events</Text><Text style={s.label}>{alerts.filter(event => event.status === "received").length} events need a response</Text><Pressable onPress={() => router.push("/alerts")} style={s.button}><Text style={s.buttonText}>Review alerts</Text></Pressable></Card>
    <StateCard title="Try the recipient alarm" description="Preview an incoming SOS on this phone. Internet delivery is not connected." action="Open SOS" onAction={() => router.push("/sos")} />
  </Screen>;
  return <Screen>
    <View style={s.row}><View style={{ flex: 1 }}><Heading title={`Hello, ${session?.name.split(" ")[0] ?? "there"}.`} subtitle="Your day at a glance." /></View><Pressable accessibilityLabel="Open your profile" onPress={() => router.push("/profile")} style={styles.profile}><Text style={s.title}>{session?.name.charAt(0).toUpperCase()}</Text></Pressable></View>
    <View style={s.row}><View style={{ flex: 1 }}><Text style={s.section}>Live stream</Text><Text style={s.label}>{running ? "Simulated · updates every 5s" : "Paused · simulated readings"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={running ? "Pause live stream" : "Resume live stream"} onPress={() => setRunning(value => !value)} style={styles.control}><Text style={s.badge}>{running ? "Pause" : "Resume"}</Text></Pressable></View>
    <Text style={s.label}>Last sample · {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</Text>
    <View style={styles.metrics}>{metrics.map(({ label, value, unit, Icon, color }) => <View key={label} style={[styles.metric, width < 600 && styles.metricNarrow, label === "Movement" && width < 600 && styles.metricWide]}>
      <View style={{ gap: 8 }}><Icon size={22} color={color} /><Text style={[styles.metricLabel, width < 360 && { minHeight: 38 }]}>{label}</Text></View><View style={{ gap: 4 }}><SoftValue value={value} style={styles.value} /><Text style={s.label}>{unit}</Text></View>
    </View>)}</View>
    <Disclosure title="Your bracelet & trusted person">
      <PersonalRoleSwitch />
      <Card><View style={s.row}><Watch color={colors.green} size={24} /><View style={{ flex: 1 }}><Text style={s.title}>Demo bracelet · GC-P01</Text><Text style={s.label}>84% sample battery · No hardware connected</Text></View></View><Text style={s.label}>Trusted person · {demoPaired ? trustedName + " (demo)" : "Not paired"}</Text><Pressable onPress={() => router.push("/settings/devices")} style={s.choice}><Text style={s.title}>Manage devices & people →</Text></Pressable></Card>
    </Disclosure>
    <Card><Text style={s.title}>Today at a glance</Text><Text style={s.label}>Sample average · {Number((getReadings("self", "24h").reduce((sum, reading) => sum + reading.heartRate, 0) / 12).toFixed(1))} bpm · 98 min movement</Text><Text style={s.label}>Historical demo summary, separate from the live preview.</Text></Card>
    <Disclosure title="Explore your statistics"><View style={[s.row, { flexWrap: "wrap" }]}><Text style={s.section}>Your statistics</Text><View style={styles.periods}>{(["24h", "7d"] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Show your ${value} statistics`} accessibilityState={{ selected: period === value }} onPress={() => setPeriod(value)} style={[styles.period, period === value && styles.active]}><Text style={[s.title, period === value && { color: "white" }]}>{value}</Text></Pressable>)}</View></View>
    <MetricChart title="Your heart rate" icon={HeartPulse} unit="bpm" color="#B94862" labels={readings.map(r => r.label)} values={readings.map(r => r.heartRate)} />
    <MetricChart title="Your skin temperature" icon={Thermometer} unit="°C" color="#916023" labels={readings.map(r => r.label)} values={readings.map(r => r.skinTemperature)} />
    <MetricChart title="Your movement" icon={Activity} unit="min" color={colors.green} bars labels={readings.map(r => r.label)} values={readings.map(r => r.movement)} />
    <Text style={s.label}>Historical sample data · {period === "24h" ? "Two-hour samples" : "Daily summaries"}. The live demo stream above is separate from these historical fixtures.</Text>
    </Disclosure>
    <Disclosure title="Your day, in moments">
    <Card><Text style={s.badge}>DEMO TIMELINE</Text><Text style={s.title}>Bracelet connected</Text><Text style={s.label}>09:42 · Your demo bracelet reconnected.</Text><View style={styles.line} /><Text style={s.title}>A little movement</Text><Text style={s.label}>09:30 · Activity sample recorded.</Text><View style={styles.line} /><Text style={s.title}>Ready for your day</Text><Text style={s.label}>08:00 · Daily sample history available.</Text></Card></Disclosure>
    <Pressable accessibilityRole="button" onPress={() => router.push("/subscription")} style={({ pressed }) => [styles.membership, pressed && { opacity: 0.7 }]}><View style={{ flex: 1 }}><Text style={s.title}>Make room for more.</Text><Text style={s.label}>Explore Plus and Pro subscriptions</Text></View><ArrowUpRight color={colors.ink} size={24} /></Pressable>
  </Screen>;
}
const styles = StyleSheet.create({
  profile: { width: 48, height: 48, backgroundColor: "#E9EFEB", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  device: { flexDirection: "row", gap: 12, alignItems: "center", flex: 1 },
  control: { minHeight: 48, padding: 14, backgroundColor: "#EAF1ED", borderRadius: 14 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexGrow: 1, flexBasis: 130, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: "white", gap: 8 },
  metricNarrow: { flexBasis: "45%", minWidth: 0, padding: 16 },
  metricWide: { flexBasis: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  metricLabel: { fontSize: 13, lineHeight: 19, color: "#626262" },
  value: { fontSize: 34, fontWeight: "800", color: colors.ink, letterSpacing: -1 },
  periods: { flexDirection: "row", gap: 4, backgroundColor: "#EAF1ED", padding: 4, borderRadius: 15 },
  period: { minHeight: 44, minWidth: 50, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  active: { backgroundColor: colors.green },
  line: { height: 1, backgroundColor: colors.line, marginVertical: 5 },
  membership: { padding: 20, borderRadius: 20, backgroundColor: "#EFEFEA", flexDirection: "row", gap: 12, alignItems: "center" },
});
