import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Text, View } from "react-native";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Action, colors, s } from "./ui";
export function useUnsavedChanges(dirty: boolean) {
 const navigation = useNavigation();
 const keepEditing = useRef<View | null>(null);
 const pending = useRef<null | (() => void)>(null);
 const [visible, setVisible] = useState(false);
 usePreventRemove(dirty, ({ data }) => { pending.current = () => navigation.dispatch(data.action); setVisible(true); });
 useEffect(() => {
  if (Platform.OS !== "web" || !dirty || typeof window === "undefined") return;
  const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
 }, [dirty]);
 const cancel = () => { pending.current = null; setVisible(false); };
 return <Modal onShow={() => keepEditing.current?.focus()} visible={visible} transparent animationType="fade" onRequestClose={cancel}>
  <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#00000088" }}>
   <View accessibilityViewIsModal style={[s.card, { maxWidth: 440, width: "100%", alignSelf: "center" }]}>
    <Text accessibilityRole="header" style={s.title}>Discard unsaved changes?</Text>
    <Text style={s.label}>Your last saved details will stay unchanged.</Text>
    <Action ref={keepEditing} onPress={cancel} style={s.button}><Text style={s.buttonText}>Keep editing</Text></Action>
    <Action onPress={() => { const resume = pending.current; pending.current = null; setVisible(false); resume?.(); }} style={s.choice}><Text style={[s.title, { color: colors.red }]}>Discard changes</Text></Action>
   </View>
  </View>
 </Modal>;
}
