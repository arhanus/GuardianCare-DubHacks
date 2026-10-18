import { useState } from "react";
import { Text, TextInput } from "react-native";
import { Card, Action, s, colors } from "../ui";
import { useSession } from "../session";
export function RecipientSetup() {
 const { session, demoPaired, trustedName, pairRecipient, unpairRecipient, selectedRecipientId, recipients, selectRecipient } = useSession();
 const [adding, setAdding] = useState(false);
 const [code, setCode] = useState("");
 const [name, setName] = useState("");
 const [error, setError] = useState("");
 const organization = session?.type === "organization";
 const pair = () => {
  if (!name.trim()) { setError("Enter a demo recipient name."); return; }
  if (code !== "482731") { setError("Use demo code 482731."); return; }
  pairRecipient(name); setAdding(false); setCode(""); setError("");
 };
 return <Card>
  <Text style={s.title}>{organization ? "Nurse recipient" : "Trusted person"}</Text>
  {recipients.length > 0 && <><Text style={s.label}>Saved demo contacts</Text>{recipients.map(recipient => <Action key={recipient.id} accessibilityRole="radio" accessibilityState={{ checked: recipient.id === selectedRecipientId }} onPress={() => { selectRecipient(recipient.id); setAdding(false); setName(recipient.name); setCode(""); setError(""); }} style={[s.choice, recipient.id === selectedRecipientId && s.choiceSelected]}><Text style={s.title}>{recipient.name}</Text><Text style={s.label}>{recipient.paired ? "Demo paired" : "Not paired"}</Text></Action>)}</>}
  {demoPaired && !adding ? <>
   <Text accessibilityLiveRegion="polite" style={s.badge}>Demo recipient paired · {trustedName}</Text>
   <Text style={s.label}>Local preview. No device link or internet delivery.</Text>
   <Action onPress={() => unpairRecipient(selectedRecipientId)} style={s.choice}><Text style={s.title}>Unpair demo phone</Text></Action>
  </> : <>
   <Text style={s.label}>Demo code · <Text selectable style={s.title}>482731</Text></Text>
   <Text style={s.label}>Preview pairing with fictional details. This code does not connect two phones.</Text>
   <Text style={s.label}>Recipient name</Text>
   <TextInput accessibilityLabel="Demo recipient name" value={name} maxLength={60} onChangeText={value => { setName(value); setError(""); }} style={s.input} />
   <Text style={s.label}>Six-digit pairing code</Text>
   <TextInput accessibilityLabel="Six-digit pairing code" value={code} onChangeText={value => { setCode(value.replace(/[^0-9]/g, "").slice(0, 6)); setError(""); }} keyboardType="number-pad" maxLength={6} autoComplete="off" placeholder="Enter demo code" placeholderTextColor={colors.muted} style={s.input} onSubmitEditing={pair} />
   {!!error && <Text accessibilityRole="alert" style={[s.label, s.danger]}>{error}</Text>}
   <Action disabled={code.length !== 6} onPress={pair} style={s.button}><Text style={s.buttonText}>Pair demo recipient</Text></Action>
  </>}
 <Action onPress={() => { setAdding(true); setName(""); setCode(""); setError(""); }} style={s.choice}><Text style={s.title}>Add a demo contact</Text></Action>
 </Card>;
}
