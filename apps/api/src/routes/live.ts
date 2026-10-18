import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import type { LiveHub } from "../services/live-hub.js";
import type { NurseVerifier } from "../services/nurse-auth.js";

interface Deps {
  config: Env;
  verifier: NurseVerifier;
  hub: LiveHub;
}

/**
 * GET /api/live (WebSocket). Pushes `reading`, `alert` and `alert_updated` messages (see LiveHub).
 * React Native cannot set headers on a WebSocket reliably, so the nurse token goes in `?token=`
 * (only required when REQUIRE_NURSE_AUTH=true). The token is never logged: the query string is
 * not part of the logged route.
 */
export async function liveRoutes(app: FastifyInstance, { config, verifier, hub }: Deps) {
  app.get("/api/live", { websocket: true }, async (socket, req) => {
    if (config.REQUIRE_NURSE_AUTH) {
      const token = (req.query as { token?: string }).token;
      const user = token ? await verifier.verify(token) : null;
      if (!user) {
        socket.close(1008, "unauthorized");
        return;
      }
    }
    const send = (data: unknown) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(data));
    };
    const unsubscribe = hub.subscribe(send);
    send({ type: "hello", serverTime: new Date().toISOString() });
    const ping = setInterval(() => send({ type: "ping" }), 25_000);
    const cleanup = () => {
      clearInterval(ping);
      unsubscribe();
    };
    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });
}
