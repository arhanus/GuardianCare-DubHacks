/** Build-time default; Profile can override it at runtime (see src/server-url.tsx). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
/** The resident a Family account follows (Patient C, room 203, wears the real wristband). */
export const FAMILY_RESIDENT_ID = process.env.EXPO_PUBLIC_FAMILY_RESIDENT_ID ?? process.env.EXPO_PUBLIC_DEMO_PATIENT_ID ?? "11111111-1111-4111-8111-111111111203";
