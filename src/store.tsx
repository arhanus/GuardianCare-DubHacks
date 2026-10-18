import React, { createContext, useContext, useState } from "react";
import { initialAlerts } from "./data";

const AlertContext = createContext<{
  alerts: typeof initialAlerts;
  respond: (id: string) => void;
} | null>(null);
export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  return (
    <AlertContext.Provider
      value={{
        alerts,
        respond: (id) =>
          setAlerts((items) =>
            items.map((item) =>
              item.id === id ? { ...item, responding: true } : item,
            ),
          ),
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}
export function useAlerts() {
  const value = useContext(AlertContext);
  if (!value) throw new Error("AlertProvider is required");
  return value;
}
