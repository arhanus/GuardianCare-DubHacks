import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Vibration } from "react-native";
import { router } from "expo-router";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useSession } from "./session";
import { useAlerts } from "./store";
import { useLive } from "./live";
import { RING_LOOKBACK_MS, escalation, ringingEvents } from "./live-policy";

import { rememberSOS } from "./sos-policy";
import { isWarning } from "./event-policy";

type Signal = { id: string; personId: string; receivedAt: string; simulation: boolean };
const SOSContext = createContext<{
  signal: Signal | null; playing: boolean; audioReady: boolean; error: string;
  startAlarm: () => void; stopAlarm: () => void;
  simulateSOS: (personId: string) => void; acceptSignal: () => void;
} | null>(null);

export function SOSProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { addTest, respond, alerts, people } = useAlerts();
  const live = useLive();
  // Fixed at sign-in (this provider remounts per role). Alerts created before it are history: listed, but silent.
  const [ringSince] = useState(() => Date.now() - RING_LOOKBACK_MS);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const player = useAudioPlayer(require("../assets/sos-alarm.wav"), { updateInterval: 250 });
  const playback = useAudioPlayerStatus(player);
  const [audioModeReady, setAudioModeReady] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [error, setError] = useState("");
  const seen = useRef(new Set<string>());
  const warned = useRef(new Set<string>());
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
    if (session?.role !== "caregiver" || !people.some(person => person.id === personId)) return;
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
  // Doorbell: ring while ANY live alert is still waiting for a caregiver. Only acknowledging silences it, and
  // it restarts if the app comes back to the foreground. Family phones do not ring.
  const ringing = session?.role === "caregiver" ? ringingEvents(alerts, ringSince) : [];
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
  // Warnings (yellow) never ring: a short double vibration once per new warning, then they wait in Alerts.
  const warningKey = session?.role === "caregiver"
    ? alerts.filter(event => event.remote && isWarning(event) && event.status === "received" && Date.parse(event.recordedAt ?? "") >= ringSince).map(event => event.id).join(",")
    : "";
  useEffect(() => {
    if (!warningKey) return;
    let fresh = false;
    for (const id of warningKey.split(",")) if (rememberSOS(warned.current, id)) fresh = true;
    if (fresh) Vibration.vibrate([0, 250, 150, 250]);
  }, [warningKey]);
  // The alert that was ringing got accepted (here or on another phone): stop the sound.
  useEffect(() => {
    if (!targetId && !signal) player.pause();
  }, [targetId, signal, player]);
  // Nobody accepted a critical alarm for ESCALATE_AFTER_MS: vibrate continuously instead of in pulses.
  const escalated = ringing.some(event => escalation(event, live.now)?.escalated);
  useEffect(() => {
    if (!playback.playing) return;
    if (escalated) { Vibration.vibrate([0, 800, 200], true); return () => Vibration.cancel(); }
    Vibration.vibrate(600);
    const timer = setInterval(() => Vibration.vibrate(600), 1200);
    return () => { clearInterval(timer); Vibration.cancel(); };
  }, [playback.playing, escalated]);
  return <SOSContext.Provider value={{ signal: activeSignal, playing: playback.playing,
    audioReady: audioModeReady && playback.isLoaded, error: error || playback.error || "",
    startAlarm, stopAlarm, simulateSOS,
    acceptSignal: () => { stopAlarm(); if (activeSignal) respond(activeSignal.id); },
  }}>{children}</SOSContext.Provider>;
}
export function useSOS() {
  const value = useContext(SOSContext);
  if (!value) throw new Error("SOSProvider is required");
  return value;
}


