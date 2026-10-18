import { useEffect, useRef, useState } from "react";
import { Platform, Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "../ui";
import { motion, useReducedMotion } from "../motion";

export function RollingPrice({ amount, yearly }: { amount: number; yearly: boolean }) {
  const [progress] = useState(() => new Animated.Value(1));
  const [frames, setFrames] = useState({ previous: { amount, yearly }, current: { amount, yearly } });
  const last = useRef({ amount, yearly });
  const [height, setHeight] = useState(44);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (last.current.amount === amount && last.current.yearly === yearly) {
      progress.setValue(1);
      return;
    }
    const previous = last.current;
    last.current = { amount, yearly };
    setFrames({ previous, current: { amount, yearly } });
    progress.setValue(reducedMotion ? 1 : 0);
    if (reducedMotion) return;
    const animation = Animated.timing(progress, {
      toValue: 1, duration: motion.standard, easing: motion.easing, useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [amount, yearly, progress, reducedMotion]);
  const direction = frames.current.yearly ? 1 : -1;
  const label = (value: { amount: number; yearly: boolean }) => <Text style={styles.price}>${value.amount.toLocaleString("en-US")}<Text style={styles.period}> /{value.yearly ? "yr" : "mo"}</Text></Text>;
  return <View accessible accessibilityRole="text" accessibilityLabel={`$${amount.toLocaleString("en-US")} per ${yearly ? "year" : "month"}`} accessibilityLiveRegion="polite" style={styles.window}>
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <View style={styles.measure} onLayout={event => setHeight(event.nativeEvent.layout.height)}>{label({ amount, yearly })}</View>
      <Animated.View style={[styles.layer, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -direction * height] }) }], opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.3, 0] }) }]}>{label(frames.previous)}</Animated.View>
      <Animated.View style={[styles.layer, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [direction * height, 0] }) }], opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.3, 1] }) }]}>{label(frames.current)}</Animated.View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  window: { overflow: "hidden" },
  measure: { opacity: 0 },
  layer: { position: "absolute", top: 0, left: 0, right: 0 },
  price: { color: colors.ink, fontSize: 36, lineHeight: 46, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  period: { color: "#626262", fontSize: 16, fontWeight: "500", letterSpacing: 0 },
});
