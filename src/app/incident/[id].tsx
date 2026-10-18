import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text } from "react-native";
import { people } from "../../data";
import { useAlerts } from "../../store";
import { Card, Heading, Screen, s } from "../../ui";
export default function Incident() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts, respond } = useAlerts();
  const alert = alerts.find((a) => a.id === id);
  if (!alert)
    return (
      <Screen>
        <Heading
          title="Incident not found"
          subtitle="Return to Alerts to review a demo event."
        />
      </Screen>
    );
  const person = people.find((p) => p.id === alert.personId)!;
  return (
    <Screen>
      <Heading
        title={alert.title}
        subtitle={`${person.name} · ${person.room}`}
      />
      <Card>
        <Text style={[s.badge, !alert.responding && s.danger]}>
          {alert.responding ? "● Responding" : "● Needs response"}
        </Text>
        <Text style={s.label}>
          Event recorded at {alert.time} · Simulated event
        </Text>
        <Text style={s.title}>
          {alert.type === "SOS"
            ? "A request for a helping hand."
            : "Check in on the connection."}
        </Text>
        <Text style={s.subtitle}>{alert.description}</Text>
      </Card>
      <Text style={s.section}>Response</Text>
      <Text style={s.label}>
        Acknowledging records that you’ve seen this event. It does not contact
        the person, dispatch help, or resolve the incident.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: alert.responding }}
        disabled={alert.responding}
        style={[s.button, alert.responding && { opacity: 0.65 }]}
        onPress={() => respond(alert.id)}
      >
        <Text style={s.buttonText}>
          {alert.responding ? "You’re responding" : "I’m Responding"}
        </Text>
      </Pressable>
      {alert.responding && (
        <Text accessibilityLiveRegion="polite" style={s.badge}>
          Acknowledged in this demo session.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        style={s.card}
        onPress={() => router.push(`/person/${person.id}`)}
      >
        <Text style={s.badge}>View {person.name}’s device details →</Text>
      </Pressable>
    </Screen>
  );
}
