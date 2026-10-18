import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { initials, useAlerts, type Patient } from "../store";
import { useSession } from "../session";
import { fallRiskLabel, useResidentProfiles, type FallRisk } from "../resident-profiles";
import { Screen, Heading, Card, Action, StateCard, s } from "../ui";
import { useUnsavedChanges } from "../unsaved-changes";

const textFields = [
 ["name", "Resident name"], ["room", "Room or floor"], ["caregiver", "Key caregiver"], ["age", "Age"],
 ["conditions", "Conditions (e.g. heart condition, dementia)"], ["medications", "Medications and allergies"],
 ["contactName", "Emergency contact name"], ["contactPhone", "Emergency contact phone"],
] as const;

/** Resident profile editor. Care details are stored on this phone (not on the server). */
export default function ResidentEditor() {
 const { id } = useLocalSearchParams<{ id?: string }>();
 const { people, savePatient } = useAlerts();
 const { profile, save: saveProfile } = useResidentProfiles();
 const { session } = useSession();
 const existing = people.find(person => person.id === id);
 const [fields, setFields] = useState(() => ({ name: existing?.name ?? "", room: existing?.room ?? "", caregiver: existing?.caregiver ?? "", ...profile(id ?? "") }));
 const [baseline, setBaseline] = useState(fields);
 const [savedId, setSavedId] = useState(id ?? "");
 const [saved, setSaved] = useState(false);
 const [error, setError] = useState("");
 const dirty = JSON.stringify(fields) !== JSON.stringify(baseline);
 const leaveDialog = useUnsavedChanges(dirty);
 if (session?.role !== "caregiver" || id && !existing) return <Screen><StateCard title="Resident unavailable" description="Choose a resident from the resident list." action="Back to residents" onAction={() => router.replace("/")} /></Screen>;
 const change = (key: keyof typeof fields, value: string) => { setFields(current => ({ ...current, [key]: value })); setError(""); setSaved(false); };
 const save = () => {
  if (!fields.name.trim() || !fields.room.trim()) { setError("Enter the resident's name and room or floor."); return; }
  const residentId = savedId || `resident-${Date.now()}`;
  const { name, room, caregiver, ...care } = fields;
  const cleanName = name.trim();
  const resident: Patient = { ...(existing ?? { id: residentId, device: "Unassigned", connected: false, updated: "No readings", motion: "Unavailable", caregiver: "", custom: true }), name: cleanName, room: room.trim(), caregiver: caregiver.trim(), initials: initials(cleanName) };
  savePatient(resident);
  saveProfile(residentId, { ...care, age: care.age.trim(), conditions: care.conditions.trim(), medications: care.medications.trim(), contactName: care.contactName.trim(), contactPhone: care.contactPhone.trim() });
  setFields(current => ({ ...current, name: cleanName, room: room.trim() })); setBaseline({ ...fields, name: cleanName, room: room.trim() }); setSavedId(residentId); setSaved(true); setError("");
 };
 return <Screen><Stack.Screen options={{ title: existing ? "Edit resident" : "Add resident" }} /><Heading title={existing ? "Edit resident" : "Add a resident"} subtitle="Care details stay on this phone. They are not sent to the server." />
  <Card>
   {textFields.map(([key, label]) => <View key={key} style={{ gap: 8 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={fields[key]} onChangeText={value => change(key, value)} maxLength={key === "conditions" || key === "medications" ? 300 : 80} keyboardType={key === "contactPhone" ? "phone-pad" : key === "age" ? "number-pad" : "default"} multiline={key === "conditions" || key === "medications"} style={s.input} autoComplete="off" /></View>)}
   <Text style={s.label}>Fall risk</Text>
   <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {(["low", "medium", "high"] as FallRisk[]).map(risk => <Action key={risk} accessibilityRole="radio" accessibilityState={{ checked: fields.fallRisk === risk }} onPress={() => change("fallRisk", risk)} style={[s.choice, { flex: 0, flexGrow: 1 }, fields.fallRisk === risk && s.choiceSelected]}><Text style={s.title}>{fallRiskLabel(risk)}</Text></Action>)}
   </View>
   {!!error && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{error}</Text>}
   <Text accessibilityLiveRegion="polite" style={s.label}>{dirty ? "Unsaved changes" : saved ? "Saved on this phone" : "No unsaved changes"}</Text>
   <Action onPress={save} style={s.button}><Text style={s.buttonText}>Save resident</Text></Action>
   {saved && <Action onPress={() => router.replace(`/person/${savedId}`)} style={s.choice}><Text style={s.title}>View resident profile →</Text></Action>}
   <Action onPress={() => router.back()} style={s.choice}><Text style={s.title}>{dirty ? "Cancel editing" : "Back"}</Text></Action>
  </Card>{leaveDialog}
 </Screen>;
}
