import { z } from "zod";

export const TaskPropertySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type TaskProperty = z.infer<typeof TaskPropertySchema>;

export const ArchitectureChoiceSchema = z.enum([
  "simple",
  "orchestrator",
  "parallelized",
  "specialized",
]);
export type ArchitectureChoice = z.infer<typeof ArchitectureChoiceSchema>;

export const OrganRoutingSchema = z.object({
  organId: z.string().min(1),
  priority: z.number().int().nonnegative(),
  fallback: z.boolean(),
  conditions: z.array(z.string()).optional(),
});
export type OrganRouting = z.infer<typeof OrganRoutingSchema>;
