import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { people } from "../../data";
import { useAlerts } from "../../store";
import { Card, Heading, Screen, s } from "../../ui";
export default function Alerts() {
  const { alerts } = useAlerts();
  const [activeOnly, setActiveOnly] = useState(true);
  const visible = alerts.filter((a) => !activeOnly || !a.responding);
  return (
    <Screen>
      <Heading
        title="Here when it matters."
        subtitle="Review requests and let others know you’re responding."
      />
      <View style={s.row}>
        {[true, false].map((active) => (
          <Pressable
            key={String(active)}
            accessibilityRole="button"
            accessibilityState={{ selected: activeOnly === active }}
            onPress={() => setActiveOnly(active)}
            style={[
              s.button,
              { flex: 1, opacity: activeOnly === active ? 1 : 0.65 },
            ]}
          >
            <Text style={s.buttonText}>
              {active ? "Needs response" : "All events"}
            </Text>
          </Pressable>
        ))}
      </View>
      {visible.map((alert) => (
        <Pressable
          key={alert.id}
          accessibilityRole="button"
          onPress={() => router.push(`/incident/${alert.id}`)}
        >
          <Card>
            <View style={s.row}>
              <Text style={[s.badge, !alert.responding && s.danger]}>
                {alert.responding ? "Responding" : alert.type}
              </Text>
              <Text style={s.label}>{alert.time} · Demo</Text>
            </View>
            <Text style={s.title}>{alert.title}</Text>
            <Text style={s.label}>
              {people.find((p) => p.id === alert.personId)?.name}
            </Text>
            <Text style={s.badge}>Review incident →</Text>
          </Card>
        </Pressable>
      ))}
      {visible.length === 0 && (
        <Card>
          <Text style={s.title}>All requests acknowledged</Text>
          <Text style={s.label}>
            You can review them under All events. Acknowledging does not resolve
            an incident.
          </Text>
        </Card>
      )}
    </Screen>
  );
}
