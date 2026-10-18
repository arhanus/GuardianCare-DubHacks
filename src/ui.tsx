import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const colors = {
  ink: "#171717",
  muted: "#777777",
  green: "#177658",
  background: "#FAFAFA",
  line: "#E5E5E5",
  red: "#BD3F48",
};

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.brand}>
          <Text style={s.logo}>stillhere<Text style={{ color: colors.green }}>.</Text></Text>
          <Text style={s.demo}>DEMO DATA</Text>
        </View>
        {children}
        <Text style={s.footnote}>
          Demo only · Fictional people and simulated events. Device readings cannot establish a medical condition.
        </Text>
      </ScrollView>
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
  page: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 45, maxWidth: 700, width: "100%", alignSelf: "center", gap: 17 },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  logo: { fontSize: 23, fontWeight: "800", color: colors.ink, letterSpacing: -1 },
  demo: { fontSize: 10, letterSpacing: 1.2, color: "#949494", fontWeight: "700" },
  heading: { fontSize: 29, lineHeight: 37, fontWeight: "800", color: colors.ink, letterSpacing: -0.8 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
  card: { borderRadius: 18, backgroundColor: "#FFFFFF", padding: 18, borderWidth: 1, borderColor: colors.line, gap: 12, shadowColor: "#000000", shadowOpacity: 0.025, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  label: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 8, letterSpacing: -0.3 },
  avatar: { width: 46, height: 46, backgroundColor: "#F2F2F2", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  badge: { color: colors.green, fontWeight: "700", fontSize: 12 },
  danger: { color: colors.red },
  button: { backgroundColor: "#171717", padding: 17, borderRadius: 13, alignItems: "center", minHeight: 52 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  choice: { flex: 1, minHeight: 52, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FFFFFF", justifyContent: "center" },
  choiceSelected: { borderColor: "#171717", backgroundColor: "#F2F2F2" },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 15, color: colors.ink, fontSize: 15 },
  footnote: { color: "#969696", fontSize: 11, lineHeight: 18, marginTop: 12 },
});
