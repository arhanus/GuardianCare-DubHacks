import { networkInterfaces } from "node:os";

/** First non-internal IPv4 address (private LAN ranges preferred), or null. */
export function getLanAddress(): string | null {
  const candidates: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) candidates.push(a.address);
    }
  }
  const isPrivate = (ip: string) =>
    ip.startsWith("192.168.") || ip.startsWith("10.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  return candidates.find(isPrivate) ?? candidates[0] ?? null;
}
