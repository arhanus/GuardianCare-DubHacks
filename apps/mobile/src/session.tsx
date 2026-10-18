import { createContext, useContext, useState, type ReactNode } from "react";
/** Nurse: watches every patient and gets the alarm. Patient: wears the wristband and can send SOS. */
export type Role = "nurse" | "patient";
export type SubscriptionPreference = { plan: "plus" | "pro"; yearly: boolean };
type Session = { name: string; role: Role };
const defaultSubscription = (role?: Role): SubscriptionPreference => ({ plan: role === "nurse" ? "pro" : "plus", yearly: false });
const SessionContext = createContext<{
  session: Session | null;
  enterDemo: (session: Session) => void;
  signOut: () => void;
  updateProfile: (name: string) => void;
  subscriptionPreference: SubscriptionPreference;
  saveSubscriptionPreference: (value: SubscriptionPreference) => void;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [subscriptionPreference, setSubscriptionPreference] = useState(defaultSubscription());
  return (
    <SessionContext.Provider
      value={{
        session,
        enterDemo: (value) => { setSubscriptionPreference(defaultSubscription(value.role)); setSession(value); },
        signOut: () => { setSubscriptionPreference(defaultSubscription()); setSession(null); },
        updateProfile: (name) => setSession(value => value ? { ...value, name: name.trim() || value.name } : value),
        subscriptionPreference,
        saveSubscriptionPreference: (value) => setSubscriptionPreference({ ...value, plan: session?.role === "nurse" ? "pro" : value.plan }),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is required");
  return value;
}
