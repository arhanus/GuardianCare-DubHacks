import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@guardiancare/contracts";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    service: "guardiancare-api",
  }));
}
