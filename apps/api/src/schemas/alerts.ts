import { z } from "zod";

export const alertsQuerySchema = z.object({
  // "active" is accepted as an alias of "open" (sprint-doc wording).
  status: z
    .enum(["open", "active", "acknowledged", "resolved", "all"])
    .default("all")
    .transform((s) => (s === "active" ? "open" : s)),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
