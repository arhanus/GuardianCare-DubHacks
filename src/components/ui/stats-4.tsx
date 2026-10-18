import { StyleSheet, Text, View } from "react-native";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react-native";
import { colors, s } from "../../ui";
import { AreaSparkline } from "./area-sparkline";

export type MetricSummary = {
  name: string;
  unit: string;
  color: string;
  Icon: LucideIcon;
  values: number[];
};
// Stats10 from the supplied stats-4.tsx, adapted to sensor data and native views.
export function Stats10({
  metrics,
  stale,
}: {
  metrics: MetricSummary[];
  stale: boolean;
}) {
  return (
    <View style={styles.grid}>
      {metrics.map(({ name, unit, color, Icon, values }) => {
        const latest = values.at(-1) ?? 0;
        const previous = values.at(-2) ?? latest;
        const delta = Number((latest - previous).toFixed(1));
        const TrendIcon =
          delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
        return (
          <View key={name} style={styles.card}>
            <View style={styles.heading}>
              <View style={[styles.icon, { backgroundColor: `${color}14` }]}>
                <Icon size={18} color={color} />
              </View>
              <Text style={[s.label, { flex: 1 }]}>{name}</Text>
              <Text style={styles.unit}>{unit}</Text>
            </View>
            <View style={styles.reading}>
              <Text style={[styles.value, { color }]}>{latest}</Text>
              <View style={styles.delta}>
                <TrendIcon size={15} color={colors.muted} />
                <Text style={s.label}>
                  {delta > 0 ? "+" : ""}
                  {delta} {unit}
                </Text>
              </View>
            </View>
            <Text style={styles.comparison}>
              vs previous 2h sample · {stale ? "stale" : "simulated"}
            </Text>
            <View
              accessible
              accessibilityLabel={`${name}. Last ${latest} ${unit}. Change ${delta} ${unit} versus previous two-hour sample.`}
            >
              <AreaSparkline values={values} color={color} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    flexGrow: 1,
    flexBasis: 260,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "white",
    borderRadius: 20,
    overflow: "hidden",
    padding: 18,
    paddingBottom: 0,
    gap: 10,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  unit: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  reading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  value: {
    fontSize: 34,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  delta: { flexDirection: "row", alignItems: "center", gap: 4 },
  comparison: { color: colors.muted, fontSize: 11, lineHeight: 17 },
});
