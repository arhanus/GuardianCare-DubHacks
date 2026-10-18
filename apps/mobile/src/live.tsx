import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Alert, LiveMessage, LiveReading } from "@guardiancare/contracts";
import { acknowledgeAlert, getAlerts, getPatients, getReadings, liveUrl, sendSOS, type ApiPatient } from "./api";
import { appendReading } from "./live-policy";
import { useSession } from "./session";
import { useServerUrl } from "./server-url";

type Live = {
  /** WebSocket is open: values and alarms are arriving in real time. */
  connected: boolean;
  /** First load from the backend finished (successfully or not). */
  loaded: boolean;
  error: string;
  now: number;
  patients: ApiPatient[];
  readings: Record<string, LiveReading[]>;
  alerts: Alert[];
  refresh: () => Promise<void>;
  /** Load and keep fetching the reading history of a patient while a screen shows it. Returns a release function. */
  watch: (patientId: string) => () => void;
  acknowledge: (alertId: string) => Promise<void>;
  sos: (patientId: string) => Promise<void>;
};

const LiveContext = createContext<Live | null>(null);

const upsert = (items: Alert[], alert: Alert) => items.some(item => item.id === alert.id)
  ? items.map(item => item.id === alert.id ? alert : item)
  : [alert, ...items];

/** Remounts per role and server address so signing out/in or switching server never shows stale data. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { url } = useServerUrl();
  return <LiveSession key={`${session?.role ?? "signed-out"}|${url}`} enabled={!!session}>{children}</LiveSession>;
}

function LiveSession({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [readings, setReadings] = useState<Record<string, LiveReading[]>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const watched = useRef(new Map<string, number>());
  const sosId = useRef<string | null>(null);

  const loadHistory = useCallback(async (ids: string[]) => {
    const history = await Promise.all(ids.map(async id => [id, await getReadings(id).catch(() => [])] as const));
    setReadings(current => {
      const next = { ...current };
      for (const [id, items] of history) next[id] = [...items].reverse().reduce(appendReading, current[id] ?? []);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [list, alertList] = await Promise.all([getPatients(), getAlerts()]);
      setPatients(list);
      setAlerts(alertList);
      setError("");
      const ids = list.filter(p => p.device && watched.current.has(p.id)).map(p => p.id);
      if (ids.length) await loadHistory(ids);
    } catch {
      setError("Can't reach the server. Check the server address in Profile and that this phone is on the same network.");
    } finally {
      setLoaded(true);
    }
  }, [loadHistory]);

  const watch = useCallback((patientId: string) => {
    watched.current.set(patientId, (watched.current.get(patientId) ?? 0) + 1);
    void loadHistory([patientId]);
    return () => {
      const count = (watched.current.get(patientId) ?? 1) - 1;
      if (count <= 0) watched.current.delete(patientId); else watched.current.set(patientId, count);
    };
  }, [loadHistory]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const handle = (message: LiveMessage) => {
      if (message.type === "reading") {
        const { patientId, reading } = message;
        setReadings(current => ({ ...current, [patientId]: appendReading(current[patientId] ?? [], reading) }));
        setPatients(current => current.map(p => p.id === patientId && p.device
          ? { ...p, latestReading: reading, device: { ...p.device, lastSeenAt: reading.receivedAt, isOnline: true } }
          : p));
      } else if (message.type === "alert" || message.type === "alert_updated") {
        setAlerts(current => upsert(current, message.alert));
      }
    };

    const connect = () => {
      if (stopped || (socket && socket.readyState <= WebSocket.OPEN)) return;
      const ws = new WebSocket(liveUrl());
      socket = ws;
      ws.onopen = () => { attempt = 0; setConnected(true); void refresh(); };
      ws.onmessage = event => { try { handle(JSON.parse(String(event.data)) as LiveMessage); } catch { /* ignore malformed frames */ } };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (socket === ws) socket = null;
        setConnected(false);
        if (!stopped) timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10000));
      };
    };

    const first = setTimeout(() => void refresh(), 0);
    connect();
    const poll = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 15000);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    const appState = AppState.addEventListener("change", state => {
      if (state === "active") { setNow(Date.now()); void refresh(); clearTimeout(timer); connect(); }
    });
    return () => {
      stopped = true;
      clearTimeout(first); clearTimeout(timer); clearInterval(poll); clearInterval(tick); appState.remove();
      socket?.close();
    };
  }, [enabled, refresh]);


  const acknowledge = useCallback(async (alertId: string) => {
    const updated = await acknowledgeAlert(alertId);
    setAlerts(current => upsert(current, updated));
  }, []);

  // One id per attempt: a retry after a timeout reuses it, so the server never creates a duplicate SOS.
  const sos = useCallback(async (patientId: string) => {
    sosId.current ??= `app-sos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { alert } = await sendSOS(patientId, sosId.current);
    sosId.current = null;
    setAlerts(current => upsert(current, alert));
  }, []);

  return <LiveContext.Provider value={{ connected, loaded, error, now, patients, readings, alerts, refresh, watch, acknowledge, sos }}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const value = useContext(LiveContext);
  if (!value) throw new Error("LiveProvider is required");
  return value;
}
