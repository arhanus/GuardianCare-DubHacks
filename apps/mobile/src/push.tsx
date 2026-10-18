import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { registerPushToken, unregisterPushToken } from "./api";
import { useServerUrl } from "./server-url";
import { useSession } from "./session";

// Alerts show as a banner with sound even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function setUpChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("alerts-critical", {
    name: "Critical alerts", importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 500, 250, 500], sound: "default",
  });
  await Notifications.setNotificationChannelAsync("alerts", { name: "Warnings", importance: Notifications.AndroidImportance.HIGH });
}

/** Gets this phone's Expo push token. Returns null when permission is refused. Throws if push is unsupported here. */
async function getToken(): Promise<string | null> {
  await setUpChannels();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
}

const openTarget = (response: Notifications.NotificationResponse | null) => {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
};

/**
 * Caregiver phones register for push while signed in, so a critical alert shows as a notification even when
 * the app is closed. Family phones never register. Renders nothing.
 */
export function PushRegistration() {
  const { session } = useSession();
  const { url } = useServerUrl();
  const role = session?.role;

  useEffect(() => {
    if (role !== "caregiver") return;
    let cancelled = false;
    let token: string | null = null;
    (async () => {
      try {
        const value = await getToken();
        if (!value || cancelled) return;
        token = value;
        await registerPushToken(value);
      } catch (err) {
        // Expo Go on Android has no remote push (SDK 53+), and EAS projectId may be missing: alarms still arrive over the live socket.
        console.warn("Push notifications unavailable:", err instanceof Error ? err.message : err);
      }
    })();
    return () => {
      cancelled = true;
      if (token) void unregisterPushToken(token).catch(() => undefined);
    };
  }, [role, url]);

  useEffect(() => {
    if (role !== "caregiver") return;
    try {
      openTarget(Notifications.getLastNotificationResponse());
      const subscription = Notifications.addNotificationResponseReceivedListener(openTarget);
      return () => subscription.remove();
    } catch { /* unsupported in this client */ }
  }, [role]);

  return null;
}
