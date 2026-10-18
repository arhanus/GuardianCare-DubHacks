import { createContext, useContext, useState, type ReactNode } from "react";
export type AccountType = "personal" | "organization";
export type SubscriptionPreference = { plan: "plus" | "pro"; yearly: boolean };
export type Recipient = { id: string; name: string; paired: boolean };
const defaultRecipients: Recipient[] = [{ id: "care-team", name: "Care team", paired: false }, { id: "demo-nurse", name: "Demo nurse", paired: false }];
type Session = { name: string; type: AccountType; organization?: string };
const SessionContext = createContext<{
  personalRole: "owner" | "trusted";
  setPersonalRole: (role: "owner" | "trusted") => void;
  caredName: string;
  setCaredName: (name: string) => void;
  trustedName: string;
  recipients: Recipient[];
  selectedRecipientId: string;
  selectRecipient: (id: string) => void;
  pairRecipient: (name: string) => void;
  unpairRecipient: (id: string) => void;
  demoPaired: boolean;

  session: Session | null;
  enterDemo: (session: Session) => void;
  signOut: () => void;
  updateProfile: (name: string) => void;
  preferences: { notifications: boolean; analytics: boolean };
  setPreference: (key: "notifications" | "analytics", value: boolean) => void;
  subscriptionPreference: SubscriptionPreference;
  saveSubscriptionPreference: (value: SubscriptionPreference) => void;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [personalRole, setPersonalRole] = useState<"owner" | "trusted">("owner");
  const [caredName, setCaredName] = useState("Demo loved one");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, selectRecipient] = useState("");
  const selectedRecipient = recipients.find(item => item.id === selectedRecipientId);
  const trustedName = selectedRecipient?.name ?? "Demo trusted person";
  const demoPaired = selectedRecipient?.paired ?? false;
  const pairRecipient = (name: string) => {
    const existing = recipients.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
    const id = existing?.id ?? `recipient-${Date.now()}`;
    setRecipients(items => existing ? items.map(item => item.id === id ? { ...item, paired: true } : item) : [...items, { id, name: name.trim(), paired: true }]);
    selectRecipient(id);
  };
  const unpairRecipient = (id: string) => setRecipients(items => items.map(item => item.id === id ? { ...item, paired: false } : item));
  const resetConnections = (type?: AccountType) => { setPersonalRole("owner"); setCaredName("Demo loved one"); setRecipients(type === "organization" ? defaultRecipients : type === "personal" ? [{ id: "trusted-person", name: "Demo trusted person", paired: false }] : []); selectRecipient(""); };
  const [session, setSession] = useState<Session | null>(null);
  const [preferences, setPreferences] = useState({ notifications: true, analytics: false });
  const [subscriptionPreference, setSubscriptionPreference] = useState<SubscriptionPreference>({ plan: "plus", yearly: false });
  return (
    <SessionContext.Provider
      value={{
        session, caredName, setCaredName, personalRole, setPersonalRole, trustedName, demoPaired, recipients, selectedRecipientId, selectRecipient, pairRecipient, unpairRecipient,
        enterDemo: (value) => { resetConnections(value.type); setPreferences({ notifications: true, analytics: false }); setSubscriptionPreference({ plan: value.type === "organization" ? "pro" : "plus", yearly: false }); setSession(value); },
        signOut: () => { resetConnections(); setSession(null); setPreferences({ notifications: true, analytics: false }); setSubscriptionPreference({ plan: "plus", yearly: false }); },
        updateProfile: (name) => setSession(value => value ? { ...value, name: name.trim() || value.name } : value),
        preferences,
        setPreference: (key, value) => setPreferences(current => ({ ...current, [key]: value })),
        subscriptionPreference,
        saveSubscriptionPreference: (value) => setSubscriptionPreference({ ...value, plan: session?.type === "organization" ? "pro" : value.plan }),
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
