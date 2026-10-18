import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useReducedMotion } from "../../motion";

const PATHS_PER_LAYER = 24;

/** One family of long curves sweeping from top-left to bottom-right; `position` mirrors the sweep. */
function buildPaths(position: 1 | -1) {
  return Array.from({ length: PATHS_PER_LAYER }, (_, i) => {
    const shift = i * 5 * position;
    const rise = i * 6;
    return {
      id: i,
      d: `M${-380 + shift} ${-189 - rise}C${-380 + shift} ${-189 - rise} ${-312 + shift} ${216 - rise} ${152 + shift} ${343 - rise}C${616 + shift} ${470 - rise} ${684 + shift} ${875 - rise} ${684 + shift} ${875 - rise}`,
      width: 0.6 + i * 0.04,
      opacity: 0.05 + i * 0.011,
    };
  });
}

function PathLayer({ position, gradientId }: { position: 1 | -1; gradientId: string }) {
  const paths = useMemo(() => buildPaths(position), [position]);
  return (
    <Svg width="100%" height="100%" viewBox="-400 -200 1100 1080" preserveAspectRatio="xMidYMid slice" fill="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2FA67D" />
          <Stop offset="1" stopColor="#4F7DF0" />
        </LinearGradient>
      </Defs>
      {paths.map(path => (
        <Path key={path.id} d={path.d} stroke={`url(#${gradientId})`} strokeWidth={path.width} strokeOpacity={path.opacity} />
      ))}
    </Svg>
  );
}

/** Slow back-and-forth drift on the native thread. Static when the user prefers reduced motion. */
function useDrift(duration: number, distance: number, reduced: boolean) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { progress.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(progress, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [progress, duration, reduced]);
  return {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
    transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-distance, distance] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance / 2, -distance / 2] }) },
    ],
  };
}

/**
 * Decorative flowing-line backdrop. Fill a screen by placing it first inside a relatively positioned parent;
 * it ignores touches and is hidden from screen readers.
 */
export function BackgroundPaths() {
  const reduced = useReducedMotion();
  const a = useDrift(14000, 14, reduced);
  const b = useDrift(18000, 18, reduced);
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.layer, a]}><PathLayer position={1} gradientId="gc-paths-a" /></Animated.View>
      <Animated.View style={[styles.layer, b]}><PathLayer position={-1} gradientId="gc-paths-b" /></Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Oversized so the drift never exposes an edge.
  layer: { position: "absolute", top: -30, bottom: -30, left: -30, right: -30 },
});
