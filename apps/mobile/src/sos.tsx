import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Vibration } from "react-native";
import { router } from "expo-router";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useSession } from "./session";
import { useAlerts } from "./store";
import { ApiError } from "./api";
import { useLive } from "./live";
import { RING_LOOKBACK_MS, ringingEvents } from "./live-policy";
import { DEMO_PATIENT_ID } from "../constants/config";

import { rememberSOS } from "./sos-policy";

type Signal = { id: string; personId: string; receivedAt: string; simulation: boolean };
const SOSContext = createContext<{
  signal: Signal | null; playing: boolean; audioReady: boolean; error: string;
  startAlarm: () => void; stopAlarm: () => void;
  simulateSOS: (personId: string) => void; dismissSignal: () => void; acceptSignal: () => void;
  /** Real SOS from this phone (patient role): every nurse phone rings. Resolves true when the server accepted it. */
  sendSOS: () => Promise<boolean>; sending: boolean;
} | null>(null);

export function SOSProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { addTest, respond, close, alerts, people } = useAlerts();
  const live = useLive();
  const [sending, setSending] = useState(false);
  // Fixed at sign-in (this provider remounts per role). Alerts created before it are history: listed, but silent.
  const [ringSince] = useState(() => Date.now() - RING_LOOKBACK_MS);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const player = useAudioPlayer(require("../assets/sos-alarm.wav"), { updateInterval: 250 });
  const playback = useAudioPlayerStatus(player);
  const [audioModeReady, setAudioModeReady] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [error, setError] = useState("");
  const seen = useRef(new Set<string>());
  useEffect(() => {
    let mounted = true;
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, allowsRecording: false, interruptionMode: "doNotMix", shouldRouteThroughEarpiece: false })
      .then(() => { if (mounted) setAudioModeReady(true); })
      .catch(() => { if (mounted) setError("Audio could not be prepared. Reopen the app to retry."); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => { setAppActive(state === "active"); if (state !== "active") player.pause(); });
    return () => subscription.remove();
  }, [player]);
  const stopAlarm = useCallback(() => { player.pause(); }, [player]);
  const startAlarm = useCallback(() => {
    setError("");
    if (!audioModeReady || !playback.isLoaded) { setError("Alarm audio is not ready. Please try again."); return; }
    // Expo Audio exposes imperative native setters for playback configuration.
    // eslint-disable-next-line react-hooks/immutability
    try { player.loop = true; player.volume = 1; player.play(); }
    catch { setError("Sound could not start. Check device volume and audio output."); }
  }, [player, audioModeReady, playback.isLoaded]);
  // Test alarm: rings on this phone only, nothing is sent to the server.
  const simulateSOS = (personId: string) => {
    if (session?.role !== "nurse" || !people.some(person => person.id === personId)) return;
    const id = `test-${Date.now()}`;
    if (!rememberSOS(seen.current, id)) return;
    setSignal({ id, personId, receivedAt: new Date().toISOString(), simulation: true });
    addTest(id, personId);
    startAlarm();
    router.navigate("/sos");
  };
  useEffect(() => {
    if (signal && alerts.find(event => event.id === signal.id)?.status !== "received") player.pause();
  }, [alerts, signal, player]);
  // (a remote signal only exists while its alert is unanswered, so nothing to pause for it)
  // Doorbell: ring while ANY live alert is still waiting for a nurse. Only acknowledging silences it, and
  // it restarts if the app comes back to the foreground. A patient's own phone does not ring.
  const ringing = session?.role === "nurse" ? ringingEvents(alerts, ringSince) : [];
  const ringKey = ringing.map(event => event.id).join(",");
  const target = ringing[0];
  const targetId = target?.id;
  // A live alert always takes over the screen: it is derived, not stored, so it cannot be dismissed unanswered.
  const remoteSignal = useMemo<Signal | null>(() => target ? { id: target.id, personId: target.personId, receivedAt: target.recordedAt ?? "", simulation: false } : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetId]);
  const activeSignal = remoteSignal ?? signal;
  // Plays the alarm without touching React state, so the live-alert effect below can call it safely.
  const ring = () => {
    // Expo Audio exposes imperative native setters for playback configuration.
    // eslint-disable-next-line react-hooks/immutability
    try { player.loop = true; player.volume = 1; player.play(); } catch { /* retried when playback state changes */ }
  };
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (!targetId) return;
    if (rememberSOS(seen.current, targetId)) router.navigate("/sos");
    if (appActive && audioModeReady && playback.isLoaded && !playback.playing) ring();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringKey, appActive, audioModeReady, playback.isLoaded, playback.playing]);
  // The alert that was ringing got accepted (here or on another phone): stop the sound.
  useEffect(() => {
    if (!targetId && !signal) player.pause();
  }, [targetId, signal, player]);
  useEffect(() => {
    if (!playback.playing) return;
    Vibration.vibrate(600);
    const timer = setInterval(() => Vibration.vibrate(600), 1200);
    return () => { clearInterval(timer); Vibration.cancel(); };
  }, [playback.playing]);
  const sendSOS = async () => {
    setSending(true); setError("");
    try { await live.sos(DEMO_PATIENT_ID); return true; }
    catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setError(status === 409 ? "No wristband is assigned to this patient yet, so the SOS was not sent. Call for help directly."
        : status === 404 ? "This patient was not found on the server, so the SOS was not sent. Call for help directly."
        : "SOS could not reach the server. Try again, or call for help directly.");
      return false;
    }
    finally { setSending(false); }
  };
  return <SOSContext.Provider value={{ signal: activeSignal, playing: playback.playing,
    audioReady: audioModeReady && playback.isLoaded, error: error || playback.error || "",
    startAlarm, stopAlarm, simulateSOS, sendSOS, sending,
    acceptSignal: () => { stopAlarm(); if (activeSignal) respond(activeSignal.id); },
    dismissSignal: () => { stopAlarm(); if (activeSignal) close(activeSignal.id); setSignal(null); setError(""); },
  }}>{children}</SOSContext.Provider>;
}
export function useSOS() {
  const value = useContext(SOSContext);
  if (!value) throw new Error("SOSProvider is required");
  return value;
}


