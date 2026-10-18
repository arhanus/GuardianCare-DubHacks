import { activeSOS, deviceState, patientPriority } from "../../patient-policy";
import { needsResponse } from "../../event-policy";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Search, X, ChevronRight } from "lucide-react-native";

import { CareDashboard } from "../../components/ui/care-dashboard";
import { useAlerts } from "../../store";
import { Action as Pressable, Card, Heading, Screen, colors, s } from "../../ui";
import { useSession } from "../../session";
import { useLive } from "../../live";
import { PatientHome } from "../../components/patient-home";

export default function People() {
  const [query, setQuery] = useState("");
  const { alerts, people } = useAlerts();
  const [filter, setFilter] = useState("all");
  const needsAttention = (id: string) => !!activeSOS(alerts, id) || alerts.some(event => event.personId === id && event.status === "received");
  const hasSOS = (id: string) => !!activeSOS(alerts, id);
  const { session } = useSession();
  const live = useLive();
  const count = needsResponse(alerts).length;
  const filtered = people.filter(person => `${person.name} ${person.room}`.toLowerCase().includes(query.toLowerCase().trim()))
    .filter(person => filter === "all" || (filter === "offline" || filter === "unassigned" ? deviceState(person) === filter : needsAttention(person.id)))
    .sort((a, b) => patientPriority(alerts, b.id) - patientPriority(alerts, a.id));
  if (session?.role === "patient") return <PatientHome />;
  return <Screen>
    <View style={s.row}>
      <View style={{ flex: 1, gap: 4 }}><Text style={s.badge}>Care team</Text><Text style={s.label}>{session?.name}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open your profile" onPress={() => router.push("/profile")} style={({ pressed }) => [styles.account, pressed && styles.pressed]}><Text style={s.badge}>Profile</Text><ChevronRight size={16} color={colors.green} /></Pressable>
    </View>
    <Heading title="Your patients" subtitle="The people in your care, all in one place." />
    <CareDashboard total={people.length} connected={people.filter(person => deviceState(person) === "connected").length} unassigned={people.filter(person => deviceState(person) === "unassigned").length} pending={count} onAlerts={() => router.push("/alerts")} />
    <View style={s.row}><Text accessibilityRole="header" style={s.section}>Patient profiles</Text><Text style={s.label}>{people.length} patients</Text></View>
    <Pressable onPress={() => router.push("/patient-editor")} style={s.choice}><Text style={s.title}>+ Add a patient (this phone only)</Text></Pressable>
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{[["all", "All"], ["attention", "Needs attention"], ["offline", "Offline"], ["unassigned", "Unassigned"]].map(([value, label]) => <Pressable key={value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[s.choice, { flex: 0, flexGrow: 1 }, filter === value && s.choiceSelected]}><Text style={s.title}>{label}</Text></Pressable>)}</View>
    <View style={styles.searchBlock}>
      <Text style={s.label}>Find a patient</Text>
      <View style={styles.search}>
        <Search color={colors.muted} size={19} />
        <TextInput accessibilityLabel="Search patients by name or room" placeholder="Name or room number" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" returnKeyType="search" style={styles.searchInput} />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear patient search" onPress={() => setQuery("")} style={styles.clear}><X size={18} color={colors.muted} /></Pressable>}
      </View>
      {!!query && <Text accessibilityLiveRegion="polite" style={s.label}>{filtered.length} {filtered.length === 1 ? "patient" : "patients"} found</Text>}
    </View>
    {filtered.map(person => <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`View ${person.name}'s patient profile`} onPress={() => router.push(`/person/${person.id}`)} style={({ pressed }) => pressed && styles.pressed}>
      <Card>
        <View style={s.row}><View style={s.avatar}><Text style={s.badge}>{person.initials}</Text></View><View style={{ flex: 1 }}><Text style={s.title}>{person.name}</Text><Text style={s.label}>{person.room}</Text></View><ChevronRight size={20} color={colors.muted} /></View>
        <View style={[s.row, { flexWrap: "wrap", rowGap: 8 }]}><View style={[styles.status, deviceState(person) === "offline" && styles.offline]}><View style={[styles.dot, { backgroundColor: deviceState(person) === "unassigned" ? colors.muted : person.connected ? colors.green : colors.red }]} /><Text style={[s.badge, deviceState(person) === "offline" && s.danger]}>{deviceState(person) === "unassigned" ? "Unassigned" : person.connected ? "Connected" : "Offline"}</Text></View><Text style={s.label}>{person.custom ? "No wristband" : person.device}</Text></View>
        {hasSOS(person.id) && <Text style={[s.title, s.danger]}>SOS · {activeSOS(alerts, person.id)?.status === "accepted" ? "Help in progress" : "Needs response"}</Text>}
        <Text style={s.label}>{deviceState(person) === "unassigned" ? "No wristband assigned yet" : `Last reading · ${person.updated}`}</Text>
      </Card>
    </Pressable>)}
    {filtered.length === 0 && people.length === 0 && <Card><Text style={s.title}>{live.loaded ? "No patients yet" : "Loading patients…"}</Text><Text style={s.label}>{live.loaded && !live.error ? "The server has no patients." : "Patients appear here once the server is reachable."}</Text></Card>}
    {filtered.length === 0 && people.length > 0 && <Card><Search color={colors.muted} size={28} /><Text style={s.title}>No matching patients</Text><Text style={s.label}>Try a name or room number, or reset the filters to see everyone.</Text><Pressable accessibilityRole="button" onPress={() => { setQuery(""); setFilter("all"); }} style={({ pressed }) => [s.button, pressed && styles.pressed]}><Text style={s.buttonText}>Reset filters</Text></Pressable></Card>}
  </Screen>;
}
const styles = StyleSheet.create({
  account: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: colors.greenSoft, flexDirection: "row", gap: 6, alignItems: "center" },
  searchBlock: { gap: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingLeft: 16, paddingRight: 4, minHeight: 56 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 52, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  clear: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  status: { backgroundColor: colors.greenSoft, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 },
  offline: { backgroundColor: "#FAEDED" },
  dot: { height: 6, width: 6, borderRadius: 3 },
  pressed: { opacity: 0.72 },
});
