import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AlertProvider } from "../store";
import { SessionProvider, useSession } from "../session";
import { MotionProvider } from "../motion";
import { SOSProvider } from "../sos";
import { LiveProvider } from "../live";
import { ServerProvider } from "../server-url";
import "../global.css";
export default function Layout() {
  return (
    <MotionProvider><ServerProvider><SessionProvider><LiveProvider>
      <Navigation />
    </LiveProvider></SessionProvider></ServerProvider></MotionProvider>
  );
}
function Navigation() {
  const { session } = useSession();
  return (
    <AlertProvider
      key={session?.role ?? "signed-out"}
    >
      <SOSProvider><StatusBar style={session ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerTintColor: "#171717",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#FAFAFA" },
          headerShadowVisible: false,
        }}
      >
        <Stack.Protected guard={!session}>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="patient-editor" options={{ title: "Patient profile" }} />
          <Stack.Screen name="subscription" options={{ title: "Manage subscription" }} />
          <Stack.Screen name="settings/[section]" options={{ title: "Account settings" }} />
          <Stack.Screen
            name="person/[id]"
            options={{ title: "Patient profile" }}
          />
          <Stack.Screen
            name="incident/[id]"
            options={{ title: "Event details" }}
          />
        </Stack.Protected>
      </Stack></SOSProvider>
    </AlertProvider>
  );
}
