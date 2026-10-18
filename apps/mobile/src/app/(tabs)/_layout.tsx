import { Action as Pressable } from "../../ui";
import { useEffect, useRef, useState } from "react";
import { Platform, Animated, StyleSheet, Text, View } from "react-native";
import { Tabs, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, Bell, UserRound, Siren } from "lucide-react-native";
import { useAlerts } from "../../store";
import { useSession } from "../../session";
import { isWarning, needsResponse } from "../../event-policy";
import { useReducedMotion } from "../../motion";

type BarProps = { routes: { key: string; name: string }[]; index: number };
function NavigationBar({ routes, index }: BarProps) {
  const { alerts } = useAlerts();
  const family = useSession().session?.role === "family";
  const tabRefs = useRef<(View | null)[]>([]);
  const hrefOf = (name: string) => name === "index" ? "/" : name === "profile" ? "/profile" : name === "sos" ? "/sos" : "/alerts";
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [position] = useState(() => new Animated.Value(index));
  const waiting = needsResponse(alerts);
  const count = waiting.length;
  const onlyWarnings = count > 0 && waiting.every(isWarning);
  useEffect(() => {
    if (reduced) { position.setValue(index); return; }
    const animation = Animated.spring(position, { toValue: index, damping: 28, stiffness: 280, mass: 1, useNativeDriver: Platform.OS !== "web", overshootClamping: true });
    animation.start();
    return () => animation.stop();
  }, [index, position, reduced]);
  return <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
    <View style={styles.bar}><View accessibilityRole="tablist" accessibilityLabel="Main navigation" style={styles.track} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <Animated.View pointerEvents="none" style={[styles.indicator, { width: width / routes.length, transform: [{ translateX: Animated.multiply(position, width / routes.length) }] }]} />
      {routes.map((route, routeIndex) => {
        const active = index === routeIndex;
        const isHome = route.name === "index";
        const isProfile = route.name === "profile";
        const isSOS = route.name === "sos";
        const title = isSOS ? "Alarm" : isHome ? (family ? "Home" : "Residents") : isProfile ? "Profile" : family ? "Events" : "Alerts";
        const Icon = isSOS ? Siren : isHome ? House : isProfile ? UserRound : Bell;
        return <Pressable key={route.key} ref={node => { tabRefs.current[routeIndex] = node; }} tabIndex={active ? 0 : -1}
          onKeyDown={event => {
            const target = event.key === "ArrowRight" ? (routeIndex + 1) % routes.length : event.key === "ArrowLeft" ? (routeIndex - 1 + routes.length) % routes.length : event.key === "Home" ? 0 : event.key === "End" ? routes.length - 1 : null;
            if (target === null) return;
            event.preventDefault(); router.replace(hrefOf(routes[target].name)); tabRefs.current[target]?.focus();
          }} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={title}
          onPress={() => { if (!active) router.replace(hrefOf(route.name)); }}
          style={({ pressed }) => [styles.item, pressed && { opacity: 0.65 }]}>
          <Icon size={21} strokeWidth={2} color={active ? "#151515" : "#737373"} />
          <Text maxFontSizeMultiplier={1.5} numberOfLines={1} style={[styles.label, { color: active ? "#151515" : "#737373" }]}>{title}</Text>
          {route.name === "alerts" && count > 0 && <View style={[styles.dot, onlyWarnings && { backgroundColor: "#D29B00" }]} />}
        </Pressable>;
      })}
    </View></View>
  </View>;
}
export default function TabLayout() {
  const family = useSession().session?.role === "family";
  // Family has no alarm tab: hidden from the bar (and from navigation) with href: null.
  return <Tabs screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }} tabBar={({ state, descriptors }) => {
    const routes = state.routes.filter(route => (descriptors[route.key]?.options as { href?: unknown } | undefined)?.href !== null);
    return <NavigationBar routes={routes} index={Math.max(0, routes.findIndex(route => route.key === state.routes[state.index]?.key))} />;
  }}>
    <Tabs.Screen name="index" options={{ title: "Residents" }} />
    <Tabs.Screen name="alerts" options={{ title: "Alerts" }} />
    <Tabs.Screen name="sos" options={{ title: "Alarm", href: family ? null : undefined }} />
    <Tabs.Screen name="profile" options={{ title: "Profile" }} />
  </Tabs>;
}
const styles = StyleSheet.create({
  barWrap: { width: "100%", alignItems: "center", backgroundColor: "#FAFAFA", paddingTop: 7, paddingHorizontal: 16 },
  bar: { width: "100%", maxWidth: 360, height: 72, borderRadius: 36, borderWidth: 1, borderColor: "#E6E6E6", backgroundColor: "#FFFFFF", paddingHorizontal: 8, paddingVertical: 7, shadowColor: "#000000", shadowOpacity: 0.11, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  track: { flex: 1, flexDirection: "row" },
  indicator: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: "#EAEAEA", borderRadius: 26 },
  item: { flex: 1, minHeight: 56, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 4, borderRadius: 26 },
  label: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  dot: { width: 6, height: 6, backgroundColor: "#C93D45", borderRadius: 3, position: "absolute", right: 9, top: 5 },
});

