import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AlertProvider } from "../store";
import { SessionProvider, useSession } from "../session";
export default function Layout() {
  return (
    <SessionProvider>
      <Navigation />
    </SessionProvider>
  );
}
function Navigation() {
  const { session } = useSession();
  return (
    <AlertProvider
      key={session ? `${session.type}:${session.name}` : "signed-out"}
    >
      <StatusBar style={session ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerTintColor: "#171717",
          headerStyle: { backgroundColor: "#FAFAFA" },
          headerShadowVisible: false,
        }}
      >
        <Stack.Protected guard={!session}>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="person/[id]"
            options={{ title: "Person details" }}
          />
          <Stack.Screen
            name="incident/[id]"
            options={{ title: "Incident details" }}
          />
        </Stack.Protected>
      </Stack>
    </AlertProvider>
  );
}
