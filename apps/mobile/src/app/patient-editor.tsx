import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAlerts, type Patient } from "../store";
import { useSession } from "../session";
import { Screen, Heading, Card, Action, StateCard, s } from "../ui";
import { useUnsavedChanges } from "../unsaved-changes";
export default function PatientEditor() {
 const { id } = useLocalSearchParams<{ id?: string }>();
 const { people, savePatient } = useAlerts();
 const { session } = useSession();
 const existing = people.find(person => person.id === id);
 const [fields, setFields] = useState(() => ({ name: existing?.name ?? "", room: existing?.room ?? "", caregiver: existing?.caregiver ?? "" }));
 const [baseline, setBaseline] = useState(fields);
 const [savedId, setSavedId] = useState(id ?? "");
 const [saved, setSaved] = useState(false);
 const [error, setError] = useState("");
 const dirty = JSON.stringify(fields) !== JSON.stringify(baseline);
 const leaveDialog = useUnsavedChanges(dirty);
 if (session?.role !== "nurse" || id && !existing) return <Screen><StateCard title="Patient unavailable" description="Choose a patient from the patient list." action="Back to patients" onAction={() => router.replace("/")} /></Screen>;
 const change = (key: keyof typeof fields, value: string) => { setFields(current => ({ ...current, [key]: value })); setError(""); setSaved(false); };
 const save = () => {
  if (!fields.name.trim() || !fields.room.trim()) { setError("Enter a patient name and room or location."); return; }
  const patientId = savedId || `patient-${Date.now()}`;
  const clean = { ...fields, name: fields.name.trim(), room: fields.room.trim(), caregiver: fields.caregiver.trim() };
  const patient: Patient = { ...(existing ?? { id: patientId, device: "Unassigned", connected: false, updated: "No readings", motion: "Unavailable", caregiver: "", custom: true }), ...clean, initials: clean.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() };
  savePatient(patient); setFields(clean); setBaseline(clean); setSavedId(patientId); setSaved(true); setError("");
 };
 return <Screen><Stack.Screen options={{ title: existing ? "Edit patient" : "Add patient" }} /><Heading title={existing ? "Edit patient" : "Add a patient"} subtitle="Changes stay on this phone. They are not sent to the server." />
  <Card>
   {([['name', 'Patient name'], ['room', 'Room or location'], ['caregiver', 'Assigned caregiver']] as const).map(([key, label]) => <View key={key} style={{ gap: 8 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={fields[key]} onChangeText={value => change(key, value)} maxLength={80} style={s.input} autoComplete="off" /></View>)}
   {!!error && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{error}</Text>}
   <Text accessibilityLiveRegion="polite" style={s.label}>{dirty ? "Unsaved changes" : saved ? "Saved on this phone" : "No unsaved changes"}</Text>
   <Action onPress={save} style={s.button}><Text style={s.buttonText}>Save patient</Text></Action>
   {saved && <Action onPress={() => router.replace(`/person/${savedId}`)} style={s.choice}><Text style={s.title}>View patient profile →</Text></Action>}
   <Action onPress={() => router.back()} style={s.choice}><Text style={s.title}>{dirty ? "Cancel editing" : "Back"}</Text></Action>
  </Card>{leaveDialog}
 </Screen>;
}
