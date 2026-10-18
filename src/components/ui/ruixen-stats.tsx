import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowUpRight, Radio, Users, Bell, WifiOff } from "lucide-react-native";
import { colors, s } from "../../ui";
import { AreaSparkline } from "./area-sparkline";

// Adapted from the user-supplied RuixenStats layout for React Native.
export function RuixenStats({
  total,
  connected,
  pending,
  trend,
  onAlerts,
}: {
  total: number;
  connected: number;
  pending: number;
  trend: { label: string; value: number }[];
  onAlerts: () => void;
}) {
  const stats = [
    { label: "People in care", value: total, Icon: Users },
    { label: "Needs response", value: pending, Icon: Bell },
    { label: "Connected", value: connected, Icon: Radio },
    { label: "Offline", value: total - connected, Icon: WifiOff },
  ];
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.eyebrow}>YOUR CARE AT A GLANCE</Text>
          <Text style={s.title}>Connection overview</Text>
        </View>
        <View style={styles.icon}>
          <Radio size={22} color={colors.green} />
        </View>
      </View>
      <View style={styles.hero}>
        <View
          accessible
          accessibilityLabel={`Simulated connected wearable counts. ${trend.map((point) => `${point.label}: ${point.value}`).join("; ")}`}
          style={StyleSheet.absoluteFill}
        >
          <AreaSparkline
            values={trend.map((point) => point.value)}
            domain={[0, Math.max(total, 1)]}
            color="#328E9B"
            height={190}
          />
        </View>
        <View pointerEvents="none" style={styles.heroText}>
          <Text style={styles.number}>
            {connected}
            <Text style={styles.denominator}> / {total}</Text>
          </Text>
          <Text style={styles.caption}>wearables connected</Text>
        </View>
      </View>
      <View style={styles.time}>
        <Text style={s.label}>{trend[0]?.label}</Text>
        <Text style={s.label}>Demo connection trend</Text>
        <Text style={s.label}>{trend.at(-1)?.label}</Text>
      </View>
      <View style={styles.stats}>
        {stats.map(({ label, value, Icon }) => (
          <View key={label} style={styles.stat}>
            <View style={styles.statLabel}>
              <Icon size={15} color={colors.muted} />
              <Text style={s.label}>{label}</Text>
            </View>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View safety alerts, ${pending} awaiting response`}
        style={styles.action}
        onPress={onAlerts}
      >
        <Text style={s.buttonText}>Review safety alerts</Text>
        <ArrowUpRight color="white" size={20} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    overflow: "hidden",
  },
  top: { flexDirection: "row", gap: 12, padding: 20, alignItems: "center" },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.muted,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E7F3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { height: 190, justifyContent: "center", alignItems: "center" },
  heroText: {
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFFDD",
    borderRadius: 20,
  },
  number: {
    fontSize: 60,
    fontWeight: "800",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
  },
  denominator: { fontSize: 26, color: colors.muted, fontWeight: "500" },
  caption: { fontSize: 14, color: colors.muted },
  time: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  stats: { flexDirection: "row", flexWrap: "wrap", padding: 20, gap: 16 },
  stat: { flexBasis: "44%", flexGrow: 1, gap: 8 },
  statLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  statValue: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 24,
    fontVariant: ["tabular-nums"],
  },
  action: {
    margin: 20,
    marginTop: 0,
    minHeight: 50,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
