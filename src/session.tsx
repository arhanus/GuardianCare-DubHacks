import { createContext, useContext, useState, type ReactNode } from "react";
export type AccountType = "personal" | "organization";
type Session = { name: string; type: AccountType; organization?: string };
const SessionContext = createContext<{
  session: Session | null;
  enterDemo: (session: Session) => void;
  signOut: () => void;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  return (
    <SessionContext.Provider
      value={{
        session,
        enterDemo: setSession,
        signOut: () => setSession(null),
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
