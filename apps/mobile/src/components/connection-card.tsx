import { useState } from "react";
import { Text, TextInput } from "react-native";
import { Card, Action, s, colors } from "../ui";
import { useLive } from "../live";
import { useSession } from "../session";
import { useSOS } from "../sos";
import { useAlerts } from "../store";
import { relativeTime } from "../live-policy";
import { normalizeServerUrl, testServer, useServerUrl } from "../server-url";
import { FAMILY_RESIDENT_ID } from "../../constants/config";

/** Real connection status: server address, live stream and the wristband. Nothing here is a fake pairing step. */
export function ConnectionCard() {
  const { session } = useSession();
  const live = useLive();
  const { url, isDefault, setUrl } = useServerUrl();
  const { people } = useAlerts();
  const { simulateSOS, audioReady } = useSOS();
  const [draft, setDraft] = useState(url);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const caregiver = session?.role === "caregiver";
  const wristband = live.patients.find(patient => patient.id === FAMILY_RESIDENT_ID)?.device ?? live.patients.find(patient => patient.device)?.device ?? null;
  const clean = normalizeServerUrl(draft);
  const check = async () => {
    if (!clean) { setResult("Enter an address like 192.168.1.5:3000."); return; }
    setBusy(true); setResult("");
    const ok = await testServer(clean);
    setResult(ok ? "Server reachable." : "Can't reach that address. Check the address and the network.");
    setBusy(false);
  };
  const save = async () => {
    if (!clean) { setResult("Enter an address like 192.168.1.5:3000."); return; }
    await setUrl(clean); setDraft(clean); setResult("Saved. Reconnecting…");
  };
  return <Card>
    <Text style={s.title}>Connection</Text>
    <Text style={s.label}>Live updates · {live.connected ? "Connected" : live.error ? "Server unreachable" : "Reconnecting…"}</Text>
    <Text style={s.label}>Wristband · {wristband ? `${wristband.id} · ${wristband.isOnline ? "Online" : "Offline"} · last seen ${relativeTime(wristband.lastSeenAt, live.now)}` : "none assigned"}</Text>
    <Text style={s.label}>Alarm on this phone · {caregiver ? "On: rings for every new alert" : "Off (family sees events, only caregivers get the alarm)"}</Text>
    <Text style={s.label}>Server address{isDefault ? " (default)" : ""}</Text>
    <TextInput accessibilityLabel="Server address" value={draft} onChangeText={value => { setDraft(value); setResult(""); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="192.168.1.5:3000" placeholderTextColor={colors.muted} style={s.input} />
    {!!result && <Text accessibilityLiveRegion="polite" style={[s.label, !result.startsWith("Server") && !result.startsWith("Saved") && s.danger]}>{result}</Text>}
    <Action disabled={busy} onPress={check} style={s.choice}><Text style={s.title}>{busy ? "Testing…" : "Test connection"}</Text></Action>
    <Action disabled={!clean || clean === url} onPress={save} style={s.button}><Text style={s.buttonText}>Save address</Text></Action>
    {!isDefault && <Action onPress={async () => { await setUrl(null); setDraft(""); setResult("Default address restored."); }} style={s.choice}><Text style={s.title}>Use the default address</Text></Action>}
    {caregiver && people[0] && <Action disabled={!audioReady} onPress={() => simulateSOS(people[0].id)} style={s.choice}><Text style={s.title}>Test the alarm sound</Text></Action>}
  </Card>;
}
