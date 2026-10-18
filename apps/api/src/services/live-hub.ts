import type { Alert, Reading } from "./store.js";

/** Messages pushed to connected phones over /api/live. */
export type LiveMessage =
  | { type: "reading"; patientId: string; reading: Reading & { motionG: number | null } }
  | { type: "alert"; alert: Alert }
  | { type: "alert_updated"; alert: Alert };

type Listener = (msg: LiveMessage) => void;

/** In-process pub/sub. Single API instance only (fine for the demo and one Render service). */
export class LiveHub {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(msg: LiveMessage): void {
    for (const fn of this.listeners) {
      try {
        fn(msg);
      } catch {
        // A broken socket must never affect ingestion.
      }
    }
  }

  get size(): number {
    return this.listeners.size;
  }
}
