import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform, AccessibilityInfo, Animated, Easing, Text, type StyleProp, type TextStyle } from "react-native";
import { useFocusEffect } from "expo-router";

export const motion = { short: 180, standard: 260, easing: Easing.out(Easing.cubic) };
const ReducedMotion = createContext(false);
export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return <ReducedMotion.Provider value={reduced}>{children}</ReducedMotion.Provider>;
}
export const useReducedMotion = () => useContext(ReducedMotion);

export function useScreenMotion() {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));
  useFocusEffect(useCallback(() => {
    progress.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const animation = Animated.timing(progress, { toValue: 1, duration: motion.standard, easing: motion.easing, useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]));
  return { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] };
}

export function useValueMotion(value: string) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));
  useEffect(() => {
    progress.setValue(reduced ? 1 : 0.5);
    if (reduced) return;
    const animation = Animated.timing(progress, { toValue: 1, duration: motion.short, easing: motion.easing, useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => animation.stop();
  }, [value, reduced, progress]);
  return { opacity: progress };
}
export function SoftValue({ value, style }: { value: string; style?: StyleProp<TextStyle> }) {
  const animated = useValueMotion(value);
  return <Animated.Text style={[style, animated]}><Text>{value}</Text></Animated.Text>;
}
