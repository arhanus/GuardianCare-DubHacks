export type Period = "24h" | "7d";
export type Reading = {
  label: string;
  heartRate: number;
  skinTemperature: number;
  movement: number;
};
const profiles: Record<
  string,
  { pulse: number; temperature: number; movement: number }
> = {
  alex: { pulse: 72, temperature: 33.8, movement: 1 },
  jordan: { pulse: 66, temperature: 33.1, movement: 0.6 },
  sam: { pulse: 79, temperature: 34.2, movement: 0.8 },
};
// Fixed fixtures, anchored to a fictional demo day rather than the device clock.
export function getReadings(id: string, period: Period): Reading[] {
  const profile = profiles[id];
  if (!profile) return [];
  const daily = period === "7d";
  const labels = daily
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : [
        "10:00",
        "12:00",
        "14:00",
        "16:00",
        "18:00",
        "20:00",
        "22:00",
        "00:00",
        "02:00",
        "04:00",
        "06:00",
        "08:00",
      ];
  const pulse = [0, 4, 9, 3, -2, 2, 6, -4, -6, -3, 1, 0];
  const temperature = [
    0, 0.2, 0.4, 0.3, 0.1, -0.2, 0.1, -0.3, -0.4, -0.1, 0.2, 0,
  ];
  const movement = daily
    ? [48, 72, 51, 83, 65, 94, 68]
    : [12, 18, 8, 21, 14, 6, 3, 0, 0, 1, 5, 10];
  return labels.map((label, i) => ({
    label,
    heartRate: profile.pulse + pulse[i],
    skinTemperature: Number((profile.temperature + temperature[i]).toFixed(1)),
    movement: Math.round(movement[i] * profile.movement),
  }));
}
