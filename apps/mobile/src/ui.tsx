import React, { useState } from "react";
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, type PressableProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenMotion, useValueMotion } from "./motion";
import { useLive } from "./live";
import { useSession } from "./session";

export const colors = {
  ink: "#171717",
  muted: "#626262",
  green: "#177658",
  blue: "#2563EB",
  background: "#FAFAFA",
  line: "#E5E5E5",
  red: "#BD3F48",
  surface: "#FFFFFF",
  soft: "#F2F3F0",
  greenSoft: "#EAF1ED",
};

export function Screen({ children }: { children: React.ReactNode }) {
  const entrance = useScreenMotion();
  const live = useLive();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => { setRefreshing(true); live.refresh().finally(() => setRefreshing(false)); };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><Animated.View style={[{ flex: 1 }, entrance]}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={s.brand}>
          <Text style={s.logo}>guardian<Text style={{ color: colors.blue }}>care</Text><Text style={{ color: colors.green }}>.</Text></Text>
          <Text style={s.demo}>PROTOTYPE</Text>
        </View>
        <BackendBanner />
        {children}
        <Disclosure title="About this prototype"><Text style={s.label}>Values come live from a prototype wristband and are not a clinical measurement. Alarm thresholds are demo settings. Skin temperature is not core body temperature. Patients are synthetic. Sign-in and subscriptions are not connected to real accounts or payments.</Text></Disclosure>
      </ScrollView></Animated.View></KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text accessibilityRole="header" style={s.heading}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export const s = StyleSheet.create({
  page: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 40, maxWidth: 700, width: "100%", alignSelf: "center", gap: 20 },
  brand: { gap: 8, flexWrap: "wrap", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  logo: { flexShrink: 1, fontSize: 23, fontWeight: "800", color: colors.ink, letterSpacing: -1 },
  demo: { fontSize: 12, letterSpacing: 0.5, color: colors.muted, fontWeight: "700" },
  heading: { fontSize: 29, lineHeight: 37, fontWeight: "800", color: colors.ink, letterSpacing: -0.8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 6 },
  card: { borderRadius: 20, backgroundColor: colors.surface, padding: 20, borderWidth: 1, borderColor: colors.line, gap: 12, shadowColor: "#000000", shadowOpacity: 0.025, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 16, lineHeight: 23, fontWeight: "700", color: colors.ink },
  label: { fontSize: 15, color: colors.muted, lineHeight: 23 },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 8, letterSpacing: -0.3 },
  avatar: { width: 46, height: 46, backgroundColor: "#F2F2F2", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  badge: { color: colors.green, fontWeight: "700", fontSize: 12 },
  danger: { color: colors.red },
  button: { backgroundColor: "#171717", padding: 17, borderRadius: 13, alignItems: "center", minHeight: 52 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  choice: { flex: 1, minHeight: 52, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FFFFFF", justifyContent: "center" },
  choiceSelected: { borderColor: "#171717", backgroundColor: "#F2F2F2" },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, minHeight: 52, padding: 15, color: colors.ink, fontSize: 16 },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 12 },
});

// Shared press feedback and disabled semantics on web and native.
export function Action({ style, disabled, accessibilityState, onKeyDown, ...props }: PressableProps & { ref?: React.Ref<View>; onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void }) {
 return <Pressable {...props} {...(Platform.OS === "web" ? { onKeyDown } : {})} disabled={disabled} accessibilityRole={props.accessibilityRole ?? "button"} accessibilityState={{ ...accessibilityState, disabled: !!disabled }} aria-selected={props.accessibilityRole === "tab" ? accessibilityState?.selected : undefined} aria-pressed={!props.accessibilityRole || props.accessibilityRole === "button" ? accessibilityState?.selected : undefined} aria-expanded={accessibilityState?.expanded} aria-checked={accessibilityState?.checked} style={state => [{ minHeight: 44 }, typeof style === "function" ? style(state) : style, (state.pressed || disabled) && { opacity: disabled ? 0.45 : 0.7 }]} />;
}
export function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
 const [open, setOpen] = useState(false);
 const reveal = useValueMotion(String(open));
 return <View style={{ gap: 12 }}><Action accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={s.choice}><Text style={s.title}>{title} {open ? "−" : "+"}</Text></Action>{open && <Animated.View style={[{ gap: 12 }, reveal]}>{children}</Animated.View>}</View>;
}
export function StateCard({ title, description, action, onAction, loading = false }: { title: string; description: string; action?: string; onAction?: () => void; loading?: boolean }) {
 return <Card>{loading && <ActivityIndicator accessibilityLabel="Loading" color={colors.green} />}<Text accessibilityRole="header" style={s.title}>{title}</Text><Text style={s.label}>{description}</Text>{action && onAction && <Action onPress={onAction} style={s.choice}><Text style={s.title}>{action}</Text></Action>}</Card>;
}

/** One place that tells the user when the server or the live stream is unreachable. */
function BackendBanner() {
 const { session } = useSession();
 const live = useLive();
 if (!session) return null;
 if (!live.loaded) return <Card><Text accessibilityLiveRegion="polite" style={s.label}>Connecting to the server…</Text></Card>;
 if (live.error) return <Card>
  <Text accessibilityRole="alert" style={[s.title, s.danger]}>No connection</Text>
  <Text style={s.label}>{live.error} Alarms and live values are paused until it is back.</Text>
  <Action onPress={() => void live.refresh()} style={s.button}><Text style={s.buttonText}>Try again</Text></Action>
 </Card>;
 if (!live.connected) return <Card><Text accessibilityLiveRegion="polite" style={[s.label, s.danger]}>Reconnecting to live updates…</Text></Card>;
 return null;
}
