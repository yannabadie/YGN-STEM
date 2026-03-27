import { z } from "zod";
import { RequestIdSchema, OutcomeSchema } from "./common.js";

export const SkillMaturitySchema = z.enum([
  "nascent",
  "developing",
  "proficient",
  "expert",
  "deprecated",
]);
export type SkillMaturity = z.infer<typeof SkillMaturitySchema>;

export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  maturity: SkillMaturitySchema,
  tags: z.array(z.string()),
  version: z.string().min(1),
  organId: z.string().optional(),
  successRate: z.number().min(0).max(1).optional(),
  usageCount: z.number().int().nonnegative().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillMatchResultSchema = z.object({
  skillId: z.string().min(1),
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});
export type SkillMatchResult = z.infer<typeof SkillMatchResultSchema>;

export const SkillOutcomeSchema = z.object({
  skillId: z.string().min(1),
  requestId: RequestIdSchema,
  outcome: OutcomeSchema,
  durationMs: z.number().nonnegative(),
  errorMessage: z.string().optional(),
});
export type SkillOutcome = z.infer<typeof SkillOutcomeSchema>;
