import { useId } from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

/** Native SVG equivalent of the area charts in the supplied 21st.dev blocks. */
export function AreaSparkline({
  values,
  color,
  height = 72,
  domain,
}: {
  values: number[];
  color: string;
  height?: number;
  domain?: [number, number];
}) {
  const gradient = `area-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!values.length) return null;
  const low = domain?.[0] ?? Math.min(...values) - 1;
  const high = domain?.[1] ?? Math.max(...values) + 1;
  const points = values.map(
    (value, index) =>
      `${8 + (index * 284) / Math.max(values.length - 1, 1)},${8 + (1 - (value - low) / Math.max(high - low, 1)) * 80}`,
  );
  const line = `M ${points.join(" L ")}`;
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 300 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.28} />
          <Stop offset="1" stopColor={color} stopOpacity={0.01} />
        </LinearGradient>
      </Defs>
      <Path d={`${line} L 292,100 L 8,100 Z`} fill={`url(#${gradient})`} />
      <Path
        d={line}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
