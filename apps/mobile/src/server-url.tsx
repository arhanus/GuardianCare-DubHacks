import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL as DEFAULT_API_URL } from "../constants/config";

const STORAGE_KEY = "guardiancare.serverUrl";
let current = DEFAULT_API_URL;

/** Base URL of the API, read by api.ts on every request so a change applies immediately. */
export const getApiUrl = () => current;

/** Accepts "192.168.1.5:3000", "http://host:3000/" etc. Returns a clean base URL, or null if unusable. */
export function normalizeServerUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const url = text.includes("://") ? text : `http://${text}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

const ServerContext = createContext<{ url: string; isDefault: boolean; setUrl: (value: string | null) => Promise<void> } | null>(null);

/** Loads the saved server address before rendering the app, and lets Profile change it. */
export function ServerProvider({ children }: { children: ReactNode }) {
  const [url, setUrlState] = useState(current);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => { const clean = saved ? normalizeServerUrl(saved) : null; if (clean) { current = clean; if (mounted) setUrlState(clean); } })
      .catch(() => { /* storage unavailable: keep the build-time default */ })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  const setUrl = async (value: string | null) => {
    const clean = value ? normalizeServerUrl(value) : null;
    current = clean ?? DEFAULT_API_URL;
    setUrlState(current);
    try { if (clean) await AsyncStorage.setItem(STORAGE_KEY, clean); else await AsyncStorage.removeItem(STORAGE_KEY); } catch { /* not persisted; still applies for this run */ }
  };
  if (!ready) return null;
  return <ServerContext.Provider value={{ url, isDefault: url === DEFAULT_API_URL, setUrl }}>{children}</ServerContext.Provider>;
}

export function useServerUrl() {
  const value = useContext(ServerContext);
  if (!value) throw new Error("ServerProvider is required");
  return value;
}

/** Checks GET /api/health on a candidate address. */
export async function testServer(base: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}/api/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
