import { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Line,
  Polyline,
  Rect,
} from "react-native-svg";
import { Card, s } from "./ui";
export function MetricChart({
  title,
  icon: Icon,
  unit,
  values,
  labels,
  color,
  bars = false,
}: {
  title: string;
  icon: LucideIcon;
  unit: string;
  values: number[];
  labels: string[];
  color: string;
  bars?: boolean;
}) {
  const gradientId = `metric-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const low = bars ? 0 : Math.floor(min - 1);
  const high = Math.ceil(max + 1);
  const x = (i: number) => 12 + (i * 276) / Math.max(values.length - 1, 1);
  const y = (v: number) => 112 - ((v - low) / (high - low)) * 100;
  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${color}14` }]}>
          <Icon size={20} color={color} />
        </View>
        <Text style={[s.title, { flex: 1 }]}>{title}</Text>
        <View style={[styles.unit, { backgroundColor: `${color}14` }]}>
          <Text numberOfLines={1} style={[styles.unitText, { color }]}>
            {unit}
          </Text>
        </View>
      </View>
      <View style={[s.row, { flexWrap: "wrap", rowGap: 4 }]}>
        <Text style={s.label}>
          {bars ? "Total" : "Average"} ·{" "}
          {bars
            ? values.reduce((a, b) => a + b, 0)
            : Number(average.toFixed(1))}{" "}
          {unit}
        </Text>
        <Text style={s.label}>
          {min}–{max} {unit}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View
          style={{
            justifyContent: "space-between",
            paddingTop: 12,
            paddingBottom: 16,
          }}
        >
          <Text style={s.label}>{high}</Text>
          <Text style={s.label}>{low}</Text>
        </View>
        <View
          accessible
          accessibilityLabel={`${title} chart. ${labels.map((label, i) => `${label}: ${values[i]} ${unit}`).join("; ")}`}
          style={{ flex: 1 }}
        >
          <Svg
            width="100%"
            height={128}
            viewBox="0 0 300 128"
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.2} />
                <Stop offset="1" stopColor={color} stopOpacity={0.01} />
              </LinearGradient>
            </Defs>
            {[12, 62, 112].map((value) => (
              <Line
                key={value}
                x1="0"
                x2="300"
                y1={value}
                y2={value}
                stroke="#DFE8E3"
                strokeDasharray="4 4"
              />
            ))}
            {!bars && (
              <Path
                d={`M ${values.map((value, i) => `${x(i)},${y(value)}`).join(" L ")} L ${x(values.length - 1)},112 L ${x(0)},112 Z`}
                fill={`url(#${gradientId})`}
              />
            )}
            {bars ? (
              values.map((value, i) => (
                <Rect
                  key={i}
                  x={x(i) - 7}
                  y={y(value)}
                  width={14}
                  height={112 - y(value)}
                  rx={4}
                  fill={color}
                />
              ))
            ) : (
              <Polyline
                points={values
                  .map((value, i) => `${x(i)},${y(value)}`)
                  .join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </Svg>
        </View>
      </View>
      <View style={s.row}>
        <Text style={s.label}>{labels[0]}</Text>
        <Text style={s.label}>{labels[Math.floor(labels.length / 2)]}</Text>
        <Text style={s.label}>{labels[labels.length - 1]}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  unit: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  unitText: { fontSize: 12, fontWeight: "700" },
});
