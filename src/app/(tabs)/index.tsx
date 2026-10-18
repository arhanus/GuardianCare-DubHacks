import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { people } from "../../data";
import { CareDashboard } from "../../components/ui/care-dashboard";
import { useAlerts } from "../../store";
import { Card, Heading, Screen, s } from "../../ui";
import { useSession } from "../../session";
export default function People() {
  const [query, setQuery] = useState("");
  const { alerts } = useAlerts();
  const { session, signOut } = useSession();
  const count = alerts.filter((a) => !a.responding).length;
  const filtered = people.filter((p) =>
    `${p.name} ${p.room}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <Screen>
      <View style={s.row}>
        <Text style={[s.badge, { flex: 1 }]}>
          {session?.type === "organization"
            ? session.organization
            : "Personal care"}{" "}
          · {session?.name}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          style={{ padding: 12 }}
        >
          <Text style={s.badge}>Sign out</Text>
        </Pressable>
      </View>
      <Heading
        title="People & devices"
        subtitle="Connections and assistance requests at a glance."
      />
      <CareDashboard
        total={people.length}
        connected={people.filter(person => person.connected).length}
        pending={count}
        onAlerts={() => router.push("/alerts")}
      />
      <Text style={s.section}>Your people</Text>
      <TextInput
        accessibilityLabel="Search people or room"
        placeholder="Search name or room"
        placeholderTextColor="#627975"
        value={query}
        onChangeText={setQuery}
        style={s.input}
      />
      {filtered.map((person) => (
        <Pressable
          key={person.id}
          accessibilityRole="button"
          accessibilityLabel={`View ${person.name}`}
          onPress={() => router.push(`/person/${person.id}`)}
        >
          <Card>
            <View style={s.row}>
              <View style={s.avatar}>
                <Text style={s.badge}>{person.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{person.name}</Text>
                <Text style={s.label}>{person.room}</Text>
              </View>
              <Text style={s.label}>→</Text>
            </View>
            <Text style={[s.badge, !person.connected && s.danger]}>
              {person.connected ? "● Wearable connected" : "○ Connection lost"}
            </Text>
            <Text style={s.label}>Last update · {person.updated}</Text>
          </Card>
        </Pressable>
      ))}
      {filtered.length === 0 && (
        <Card>
          <Text style={s.title}>No people found</Text>
          <Text style={s.label}>Try a different name or room.</Text>
        </Card>
      )}
    </Screen>
  );
}
