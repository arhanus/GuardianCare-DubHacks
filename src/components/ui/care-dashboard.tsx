import { useEffect, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowRight, Bell, Radio, UsersRound, WifiOff } from "lucide-react-native";

type Props = {
  total: number;
  connected: number;
  pending: number;
  onAlerts: () => void;
};

/**
 * Editorial 2x2 care dashboard inspired by the supplied 21st.dev reference.
 * Counts are sourced from the demo store; no trends or diagnostics are implied.
 */
export function CareDashboard({ connected, total, pending, onAlerts }: Props) {
  const { width } = useWindowDimensions();
  const narrow = width < 430;
  const [values] = useState(() => Array.from({ length: 4 }, () => new Animated.Value(0)));

  useEffect(() => {
    Animated.stagger(
      100,
      values.map(value =>
        Animated.timing(value, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [values]);

  const stats = [
    {
      key: "people",
      label: "People in care",
      value: total.toString().padStart(2, "0"),
      note: "People enrolled",
      Icon: UsersRound,
      accent: "#707070",
    },
    {
      key: "connected",
      label: "Connected",
      value: connected.toString().padStart(2, "0"),
      note: "Wearables online",
      Icon: Radio,
      accent: "#159468",
    },
    {
      key: "alerts",
      label: "Needs response",
      value: pending.toString().padStart(2, "0"),
      note: pending ? "Review active events →" : "No pending events",
      Icon: Bell,
      accent: pending ? "#C43B44" : "#159468",
    },
    {
      key: "offline",
      label: "Offline",
      value: Math.max(0, total - connected).toString().padStart(2, "0"),
      note: "Connection unavailable",
      Icon: WifiOff,
      accent: "#7B7B7B",
    },
  ];

  return (
    <View style={styles.outer}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.heading, narrow && styles.headingNarrow]}>Dashboard overview</Text>
        <View style={styles.demoPill}><View style={styles.demoDot}/><Text style={styles.demoText}>DEMO</Text></View>
      </View>

      <View style={styles.grid}>
        {[0, 1].map(row => (
          <View key={row} style={styles.gridRow}>
            {stats.slice(row * 2, row * 2 + 2).map((item, index) => {
              const animation = values[row * 2 + index];
              const Icon = item.Icon;
              const isAlert = item.key === "alerts";
              return (
                <Animated.View
                  key={item.key}
                  style={[
                    styles.animatedCard,
                    {
                      opacity: animation,
                      transform: [{
                        translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
                      }],
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole={isAlert ? "button" : undefined}
                    accessibilityLabel={isAlert ? "Review pending safety events" : undefined}
                    disabled={!isAlert}
                    onPress={isAlert ? onAlerts : undefined}
                    style={({ pressed }) => [
                      styles.card,
                      narrow && styles.cardNarrow,
                      pressed && isAlert && styles.pressed,
                    ]}
                  >
                    <View style={styles.labelRow}>
                      <Text numberOfLines={2} style={[styles.label, narrow && styles.labelNarrow]}>{item.label}</Text>
                      <Icon color="#878787" size={narrow ? 19 : 23} strokeWidth={1.9} />
                    </View>
                    <Text style={[styles.count, narrow && styles.countNarrow]}>{item.value}</Text>
                    <View style={styles.noteRow}>
                      <View style={[styles.noteDot, { backgroundColor: item.accent }]} />
                      <Text numberOfLines={2} style={[styles.note, isAlert && pending > 0 && styles.alertNote]}>
                        {item.note}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View safety alerts"
        onPress={onAlerts}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <View style={styles.ctaIcon}><Bell size={21} color="#171717" /></View>
        <View style={styles.ctaCopy}>
          <Text style={styles.ctaTitle}>{pending ? `${pending} events await review` : "No events awaiting review"}</Text>
          <Text style={styles.ctaSubtitle}>Fictional patients · simulated events</Text>
        </View>
        <View style={styles.ctaButton}><Text style={styles.ctaButtonText}>See all</Text><ArrowRight size={16} color="#FFFFFF" /></View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderWidth: 1, borderColor: "#E3E3E3", backgroundColor: "#FFFFFF", borderRadius: 23, padding: 17, gap: 17 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 4, paddingTop: 3 },
  heading: { color: "#080808", fontSize: 24, letterSpacing: -0.7, fontWeight: "700", flexShrink: 1 },
  headingNarrow: { fontSize: 20 },
  demoPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F5F5F5", borderRadius: 30, paddingHorizontal: 9, paddingVertical: 7 },
  demoDot: { width: 6, height: 6, backgroundColor: "#858585", borderRadius: 3 },
  demoText: { fontSize: 9, color: "#777777", fontWeight: "700", letterSpacing: 1 },
  grid: { gap: 12 },
  gridRow: { flexDirection: "row", gap: 12 },
  animatedCard: { flex: 1, minWidth: 0 },
  card: { backgroundColor: "#FFFFFF", minHeight: 160, borderRadius: 18, borderWidth: 1, borderColor: "#E5E5E5", padding: 17, justifyContent: "space-between", shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardNarrow: { padding: 12, minHeight: 151 },
  pressed: { backgroundColor: "#FAFAFA", borderColor: "#D1D1D1" },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 },
  label: { fontSize: 14, lineHeight: 19, color: "#717171", fontWeight: "600", flexShrink: 1 },
  labelNarrow: { fontSize: 12, lineHeight: 16 },
  count: { color: "#090909", fontSize: 42, fontWeight: "800", letterSpacing: -1.5, fontVariant: ["tabular-nums"] },
  countNarrow: { fontSize: 35 },
  noteRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  noteDot: { width: 7, height: 7, borderRadius: 4 },
  note: { fontSize: 11, lineHeight: 15, color: "#777777", flexShrink: 1 },
  alertNote: { color: "#C43B44", fontWeight: "700" },
  cta: { backgroundColor: "#F7F7F7", borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  ctaPressed: { backgroundColor: "#EEEEEE" },
  ctaIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderRadius: 19 },
  ctaCopy: { flex: 1 },
  ctaTitle: { color: "#595959", fontSize: 12, fontWeight: "700", lineHeight: 16 },
  ctaSubtitle: { color: "#868686", fontSize: 10, lineHeight: 14, marginTop: 4 },
  ctaButton: { backgroundColor: "#1A1A1A", borderRadius: 11, paddingHorizontal: 10, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  ctaButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 11 },
});
