import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type FallRisk = "low" | "medium" | "high";
/** Care details for one resident. Stored on this phone only (not on the server). */
export type ResidentProfile = {
  age: string;
  fallRisk: FallRisk;
  conditions: string;
  medications: string;
  contactName: string;
  contactPhone: string;
};
export const emptyProfile: ResidentProfile = { age: "", fallRisk: "low", conditions: "", medications: "", contactName: "", contactPhone: "" };
const STORAGE_KEY = "guardiancare.residentProfiles";

const ProfilesContext = createContext<{
  profile: (residentId: string) => ResidentProfile;
  save: (residentId: string, profile: ResidentProfile) => void;
} | null>(null);

export function ResidentProfilesProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, ResidentProfile>>({});
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => { if (raw && mounted) setProfiles(JSON.parse(raw) as Record<string, ResidentProfile>); })
      .catch(() => { /* storage unavailable: profiles last for this run only */ });
    return () => { mounted = false; };
  }, []);
  const save = (residentId: string, next: ResidentProfile) => {
    const all = { ...profiles, [residentId]: next };
    setProfiles(all);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all)).catch(() => { /* not persisted */ });
  };
  return <ProfilesContext.Provider value={{ profile: id => ({ ...emptyProfile, ...profiles[id] }), save }}>{children}</ProfilesContext.Provider>;
}

export function useResidentProfiles() {
  const value = useContext(ProfilesContext);
  if (!value) throw new Error("ResidentProfilesProvider is required");
  return value;
}

export const fallRiskLabel = (risk: FallRisk) => risk === "high" ? "High fall risk" : risk === "medium" ? "Medium fall risk" : "Low fall risk";
export const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
