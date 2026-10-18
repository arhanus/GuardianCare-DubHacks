import { Action as Pressable } from "../ui";
import { useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Stethoscope, UsersRound } from "lucide-react-native";
import { useSession, type Role } from "../session";
import { useScreenMotion } from "../motion";
import { BackgroundPaths } from "../components/ui/background-paths";

const palette = {
  background: "#090909",
  panel: "#131313",
  line: "#333333",
  secondary: "#909090",
  text: "#F5F5F5",
  white: "#EDEDED",
};

export default function Welcome() {
  const { enterDemo } = useSession();
  const { width } = useWindowDimensions();
  const desktop = width >= 720;
  const [register, setRegister] = useState(false);
  const [role, setRole] = useState<Role>("caregiver");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const entrance = useScreenMotion();


  function continueWithEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address to continue.");
      return;
    }
    if (register && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    setError("");
    enterDemo({ name: name.trim() || (role === "caregiver" ? "Caregiver" : "Family"), role });
  }

  function enterSample() {
    setError("");
    enterDemo({ name: role === "caregiver" ? "Caregiver" : "Family", role });
  }

  function toggleMode() {
    setRegister(value => !value);
    setError("");
  }

  const renderDots = (side: "left" | "right") => (
    <View pointerEvents="none" style={[styles.dotRail, side === "left" ? styles.leftRail : styles.rightRail]}>
      {Array.from({ length: 18 }, (_, row) => (
        <View key={row} style={styles.dotRow}>
          {Array.from({ length: 5 }, (_, column) => <View key={column} style={styles.dot} />)}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <BackgroundPaths />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {desktop && renderDots("left")}
        {desktop && renderDots("right")}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, desktop ? styles.scrollDesktop : styles.scrollMobile]}
        >
          <Animated.View
            style={[
              styles.panel,
              desktop && styles.panelDesktop,
              entrance,
            ]}
          >
            <View style={styles.mark}><Text style={styles.markText}>GC</Text></View>
            <Text accessibilityRole="header" style={styles.heading}>
              {register ? "Create your account" : "Sign in to GuardianCare"}
            </Text>
            <Text style={styles.subtitle}>Fall and heart alerts for care homes.</Text>

            <View style={styles.form}>
              <View style={styles.typeRow}>
                {([
                  { value: "caregiver" as const, label: "I'm a caregiver", Icon: Stethoscope },
                  { value: "family" as const, label: "I'm family", Icon: UsersRound },
                ]).map(({ value, label, Icon }) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: role === value }}
                    onPress={() => { setRole(value); setError(""); }}
                    style={[styles.typeOption, role === value && styles.typeSelected]}
                  >
                    <Icon size={17} color={role === value ? palette.text : palette.secondary} />
                    <Text style={[styles.typeText, role === value && styles.typeTextSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              {register && (
                <>
                  <Text style={styles.fieldLabel}>Your name</Text>
                  <TextInput
                    accessibilityLabel="Your name"
                    autoComplete="off"
                    autoCapitalize="words"
                    placeholder="Your name"
                    placeholderTextColor="#797979"
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    style={[styles.input, focused === "name" && styles.inputFocused]}
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                accessibilityLabel="Email address"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={continueWithEmail}
                placeholder="name@example.com"
                placeholderTextColor="#797979"
                value={email}
                onChangeText={value => { setEmail(value); setError(""); }}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                style={[styles.input, focused === "email" && styles.inputFocused]}
              />

              {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

              <Pressable accessibilityRole="button" onPress={continueWithEmail} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.82 }]}>
                <Text style={styles.primaryText}>Continue with Email</Text>
                <ArrowRight size={19} color="#101010" />
              </Pressable>

              <View style={styles.dividerRow}><View style={styles.divider}/><Text style={styles.or}>OR</Text><View style={styles.divider}/></View>

              <Pressable accessibilityRole="button" onPress={enterSample} style={({ pressed }) => [styles.secondary, pressed && { backgroundColor: "#262626" }]}>
                <Text style={styles.secondaryText}>Continue without an account</Text>
                <ArrowRight size={18} color="#E9E9E9" />
              </Pressable>

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>{register ? "Already have an account?" : "Don't have an account?"}</Text>
                <Pressable accessibilityRole="button" onPress={toggleMode} hitSlop={8}>
                  <Text style={styles.switchLink}>{register ? "Sign in" : "Sign up"}</Text>
                </Pressable>
              </View>
              <Text style={styles.disclaimer}>
                UI preview only. No account is created or verified. Use fictional details; never enter a real password.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  scrollDesktop: { paddingHorizontal: 22, paddingVertical: 28 },
  scrollMobile: { paddingVertical: 25 },
  panel: { width: "100%", backgroundColor: "transparent", paddingHorizontal: 28, paddingTop: 32, paddingBottom: 34, alignItems: "center" },
  panelDesktop: { maxWidth: 695, backgroundColor: "rgba(19,19,19,0.88)", borderWidth: 1, borderColor: "#252525", borderRadius: 3, paddingTop: 40, paddingBottom: 36, paddingHorizontal: 46 },
  mark: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: "#3A3A3A", alignItems: "center", justifyContent: "center", marginBottom: 26 },
  markText: { color: palette.text, fontSize: 25, fontWeight: "800", letterSpacing: -0.7 },
  heading: { color: palette.text, fontSize: 31, lineHeight: 38, fontWeight: "800", textAlign: "center", letterSpacing: -1.1 },
  subtitle: { color: palette.secondary, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, marginBottom: 30 },
  form: { width: "100%", maxWidth: 465 },
  typeRow: { flexDirection: "row", gap: 9, marginBottom: 24 },
  typeOption: { flex: 1, minHeight: 47, borderRadius: 10, borderWidth: 1, borderColor: palette.line, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9, paddingHorizontal: 8 },
  typeSelected: { backgroundColor: "#2B2B2B", borderColor: "#575757" },
  typeText: { fontSize: 13, color: palette.secondary, fontWeight: "600" },
  typeTextSelected: { color: palette.text },
  fieldLabel: { color: "#C5C5C5", fontSize: 12, marginBottom: 8, fontWeight: "600", letterSpacing: 0.3 },
  input: { backgroundColor: "#070707", borderWidth: 1, borderColor: palette.line, color: palette.text, borderRadius: 10, minHeight: 57, paddingHorizontal: 16, fontSize: 16, marginBottom: 17 },
  inputFocused: { borderColor: "#A0A0A0" },
  error: { color: "#F9A4A4", fontSize: 12, lineHeight: 18, marginBottom: 15 },
  primary: { minHeight: 58, backgroundColor: palette.white, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 12, marginTop: 4 },
  primaryText: { fontSize: 16, color: "#111111", fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 15, marginVertical: 23 },
  divider: { flex: 1, height: 1, backgroundColor: "#303030" },
  or: { color: "#858585", fontWeight: "600", fontSize: 11, letterSpacing: 1.5 },
  secondary: { minHeight: 58, borderWidth: 1, borderColor: "#393939", borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  secondaryText: { fontSize: 16, color: palette.text, fontWeight: "600" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 29 },
  switchText: { color: "#8F8F8F", fontSize: 14 },
  switchLink: { color: palette.text, fontWeight: "700", fontSize: 14 },
  disclaimer: { color: "#777777", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 26, paddingHorizontal: 4 },
  dotRail: { position: "absolute", width: 85, top: 0, bottom: 0, justifyContent: "space-around", opacity: 0.6 },
  leftRail: { left: 0 },
  rightRail: { right: 0 },
  dotRow: { flexDirection: "row", justifyContent: "space-around" },
  dot: { height: 5, width: 5, backgroundColor: "#6D6D6D" },
});
