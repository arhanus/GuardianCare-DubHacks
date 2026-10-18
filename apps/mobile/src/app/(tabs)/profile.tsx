import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, UserRound, ShieldCheck, LockKeyhole, Bell, HelpCircle, FileText, CreditCard, LogOut, type LucideIcon } from "lucide-react-native";
import { useSession } from "../../session";
import { Action as Pressable, Card, Heading, Screen, colors, s } from "../../ui";

const sections: { key: string; label: string; detail: string; Icon: LucideIcon }[] = [
  { key: "devices", label: "Devices & trusted people", detail: "Demo pairing, recipients and personal role", Icon: UserRound },
  { key: "account", label: "Personal information", detail: "Your name and account details", Icon: UserRound },
  { key: "privacy", label: "Privacy & data", detail: "Sharing preferences and data controls", Icon: ShieldCheck },
  { key: "security", label: "Security", detail: "Sign-in and session information", Icon: LockKeyhole },
  { key: "notifications", label: "Notifications", detail: "Your alert preferences", Icon: Bell },
  { key: "help", label: "Help & support", detail: "Get to know GuardianCare", Icon: HelpCircle },
  { key: "about", label: "About GuardianCare", detail: "App information and demo limitations", Icon: FileText },
];
export default function Profile() {
  const { session, signOut, subscriptionPreference } = useSession();
  const org = session?.type === "organization";
  return <Screen>
    <Heading title="Your profile" subtitle="Your space. Your preferences. Your peace of mind." />
    <Card><View style={s.row}><View style={styles.avatar}><Text style={styles.initial}>{session?.name.charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={s.title}>{session?.name}</Text><Text style={s.label}>{org ? session.organization : "Personal account"}</Text><Text style={s.badge}>{org ? "Pro · hospital & care team" : "Personal · Plus & Pro available"}</Text></View></View></Card>
    <Pressable accessibilityRole="button" accessibilityLabel="Manage subscription" onPress={() => router.push("/subscription")} style={({ pressed }) => [styles.subscription, pressed && styles.pressed]}>
      <CreditCard color="white" size={25} /><View style={{ flex: 1, gap: 5 }}><Text style={[s.title, { color: "white" }]}>Manage subscription</Text><Text style={styles.light}>{subscriptionPreference.plan === "pro" ? "Pro" : "Plus"} · {subscriptionPreference.yearly ? "Yearly" : "Monthly"} preference</Text><Text style={styles.light}>No active paid subscription · Demo</Text></View><ChevronRight color="white" size={20} />
    </Pressable>
    <Text style={s.section}>Account & preferences</Text>
    <View style={styles.list}>{sections.map(({ key, label, detail, Icon }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(`/settings/${key}`)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.icon}><Icon color={colors.ink} size={21} /></View><View style={{ flex: 1 }}><Text style={s.title}>{label}</Text><Text style={s.label}>{detail}</Text></View><ChevronRight size={18} color={colors.muted} /></Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.signout, pressed && styles.pressed]}><LogOut size={20} color={colors.red} /><Text style={[s.title, { color: colors.red }]}>Sign out</Text></Pressable>
    <Text style={s.label}>Demo changes stay for this session and reset when you reload or sign out.</Text>
    <Text style={styles.version}>GuardianCare · Version 1.0.0</Text>
  </Screen>;
}
const styles = StyleSheet.create({
  avatar: { height: 64, width: 64, backgroundColor: "#EAF1ED", borderRadius: 22, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 28, color: colors.green, fontWeight: "700" },
  subscription: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, flexDirection: "row", gap: 14, alignItems: "center" },
  light: { color: "#D0D0D0", fontSize: 13, lineHeight: 20 },
  list: { backgroundColor: "white", borderRadius: 20, overflow: "hidden", borderColor: colors.line, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 17, minHeight: 80, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { padding: 10, borderRadius: 13, backgroundColor: "#F3F3F3" },
  pressed: { opacity: 0.65 },
  signout: { minHeight: 52, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 15, backgroundColor: "#FAEDED" },
  version: { textAlign: "center", color: colors.muted, fontSize: 12 },
});
