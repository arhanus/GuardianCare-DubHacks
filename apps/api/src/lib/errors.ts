import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";

/**
 * Wire shape for failures. docs/API_CONTRACT.md currently says `{ "error": "message" }`.
 * Kept in one place so a contract change (see docs/backend/CONTRACT_PROPOSALS.md) is a one-line edit.
 */
export function errorBody(_code: string, message: string): { error: string } {
  return { error: message };
}

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => {
    void reply.status(404).send(errorBody("not_found", "Route not found"));
  });

  app.setErrorHandler((err: FastifyError | AppError | ZodError, req, reply) => {
    if (err instanceof ZodError) {
      const msg = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
      return reply.status(400).send(errorBody("invalid_request", `Invalid request: ${msg}`));
    }
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send(errorBody(err.code, err.message));
    }
    const status = "statusCode" in err ? (err.statusCode ?? 500) : 500;
    if (status >= 400 && status < 500) {
      // Fastify-generated client errors (bad JSON, validation, payload too large).
      return reply.status(status).send(errorBody("bad_request", err.message));
    }
    // Never leak internals for 5xx.
    req.log.error({ err }, "unhandled error");
    return reply.status(500).send(errorBody("internal_error", "Internal server error"));
  });
}
