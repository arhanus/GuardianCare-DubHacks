import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, Bell } from "lucide-react-native";
import { useAlerts } from "../../store";

type PillProps = {
  active: boolean;
  title: string;
  icon: typeof House;
  onPress: () => void;
  badge?: number;
};

function Pill({ active, title, icon: Icon, onPress, badge }: PillProps) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      useNativeDriver: false,
      damping: 19,
      stiffness: 190,
      mass: 0.85,
    }).start();
  }, [active, progress]);

  return (
    <Animated.View
      style={[
        styles.item,
        {
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [58, 146],
          }),
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["#FFFFFF", "#EAEAEA"],
          }),
        },
      ]}
    >
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={title}
        onPress={onPress}
        style={styles.pressable}
      >
        <Icon
          size={22}
          strokeWidth={active ? 2.4 : 2}
          color={active ? "#151515" : "#888888"}
        />
        {active && <Text numberOfLines={1} style={styles.label}>{title}</Text>}
        {!!badge && <View style={styles.dot} />}
      </Pressable>
    </Animated.View>
  );
}

export default function TabLayout() {
  const { alerts } = useAlerts();
  const insets = useSafeAreaInsets();
  const count = alerts.filter((alert) => !alert.responding).length;

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      tabBar={({ state }) => (
        <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.bar}>
            {state.routes.map((route, index) => {
              const active = state.index === index;
              const isHome = route.name === "index";
              return (
                <Pill
                  key={route.key}
                  active={active}
                  title={isHome ? "Home" : "Alerts"}
                  icon={isHome ? House : Bell}
                  badge={isHome ? 0 : count}
                  onPress={() => {
                    if (!active) router.replace(isHome ? "/" : "/alerts");
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    paddingTop: 7,
    paddingHorizontal: 16,
  },
  bar: {
    width: "100%",
    maxWidth: 280,
    height: 60,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    shadowColor: "#000000",
    shadowOpacity: 0.11,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  item: {
    height: 46,
    borderRadius: 27,
    overflow: "hidden",
  },
  pressable: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 8,
  },
  label: { fontSize: 14, fontWeight: "700", color: "#151515" },
  dot: {
    width: 7,
    height: 7,
    backgroundColor: "#C93D45",
    borderRadius: 4,
    position: "absolute",
    right: 6,
    top: 6,
  },
});
