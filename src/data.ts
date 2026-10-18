export const connectionTrend = [
  { label: "02:00", value: 1 },
  { label: "04:00", value: 2 },
  { label: "06:00", value: 3 },
  { label: "08:00", value: 3 },
  { label: "09:00", value: 2 },
  { label: "09:42", value: 2 },
];
export const people = [
  {
    id: "alex",
    name: "Alex Morgan",
    initials: "AM",
    room: "Room 204 · Bed A",
    device: "SH-001",
    connected: true,
    updated: "12 seconds ago",
    motion: "Recent movement",
    battery: 84,
  },
  {
    id: "jordan",
    name: "Jordan Lee",
    initials: "JL",
    room: "Room 206 · Bed B",
    device: "SH-002",
    connected: true,
    updated: "25 seconds ago",
    motion: "No recent movement",
    battery: 62,
  },
  {
    id: "sam",
    name: "Sam Rivera",
    initials: "SR",
    room: "Room 208 · Bed A",
    device: "SH-003",
    connected: false,
    updated: "8 minutes ago",
    motion: "Unavailable",
    battery: 31,
  },
];
export const initialAlerts = [
  {
    id: "sos-001",
    personId: "alex",
    title: "Assistance requested",
    type: "SOS",
    time: "09:42",
    description:
      "The wearable SOS button was pressed. Contact the person to check what assistance they need.",
    responding: false,
  },
  {
    id: "connection-001",
    personId: "sam",
    title: "Connection lost",
    type: "Device",
    time: "09:35",
    description:
      "No recent update from this wearable. Its current state is unknown. Check the device and connection.",
    responding: false,
  },
];
