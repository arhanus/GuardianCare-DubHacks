import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useSession } from "./session";
import { useAlerts } from "./store";

import { rememberSOS } from "./sos-policy";

type Signal = { id: string; personId: string; receivedAt: string; simulation: boolean };
const SOSContext = createContext<{
  signal: Signal | null; playing: boolean; audioReady: boolean; error: string;
  startAlarm: () => void; stopAlarm: () => void;
  simulateSOS: (personId: string) => void; dismissSignal: () => void; acceptSignal: () => void;
} | null>(null);

export function SOSProvider({ children }: { children: ReactNode }) {
  const { session, personalRole } = useSession();
  const { addSOS, respond, close, alerts, people } = useAlerts();
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
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") player.pause(); });
    return () => subscription.remove();
  }, [player]);
  const stopAlarm = useCallback(() => { player.pause(); }, [player]);
  const startAlarm = useCallback(() => {
    setError("");
    if (!audioModeReady || !playback.isLoaded) { setError("Alarm audio is not ready. Please try again."); return; }
    // Expo Audio exposes imperative native setters for playback configuration.
    // eslint-disable-next-line react-hooks/immutability
    try { player.loop = true; player.volume = 0.65; player.play(); }
    catch { setError("Sound could not start. Check device volume and audio output."); }
  }, [player, audioModeReady, playback.isLoaded]);
  // Local recipient preview only. No Bluetooth receiver or remote delivery is connected.
  const simulateSOS = (personId: string) => {
    if (!session || (session.type === "personal" ? personId !== (personalRole === "trusted" ? "loved-one" : "self") : !people.some(person => person.id === personId))) return;
    const id = `test-${Date.now()}`;
    if (!rememberSOS(seen.current, id)) return;
    setSignal({ id, personId, receivedAt: new Date().toISOString(), simulation: true });
    addSOS(id, personId, true);
    startAlarm();
    router.navigate("/sos");
  };
  useEffect(() => {
    if (signal && alerts.find(event => event.id === signal.id)?.status !== "received") player.pause();
  }, [alerts, signal, player]);
  return <SOSContext.Provider value={{ signal, playing: playback.playing,
    audioReady: audioModeReady && playback.isLoaded, error: error || playback.error || "",
    startAlarm, stopAlarm, simulateSOS,
    acceptSignal: () => { stopAlarm(); if (signal) respond(signal.id); },
    dismissSignal: () => { stopAlarm(); if (signal) close(signal.id); setSignal(null); setError(""); },
  }}>{children}</SOSContext.Provider>;
}
export function useSOS() {
  const value = useContext(SOSContext);
  if (!value) throw new Error("SOSProvider is required");
  return value;
}


