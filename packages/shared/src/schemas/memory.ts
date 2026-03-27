import { z } from "zod";
import {
  CallerIdSchema,
  RequestIdSchema,
  ImportanceScoreSchema,
  TimestampSchema,
  EmbeddingSchema,
  ConfidenceSchema,
} from "./common.js";

export const FactTripleSchema = z.object({
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidence: ConfidenceSchema.optional(),
  sourceId: z.string().optional(),
});
export type FactTriple = z.infer<typeof FactTripleSchema>;

export const EpisodeSchema = z.object({
  id: z.string().min(1),
  callerId: CallerIdSchema,
  requestId: RequestIdSchema,
  summary: z.string().min(1),
  importance: ImportanceScoreSchema,
  timestamp: TimestampSchema,
  embedding: EmbeddingSchema.optional(),
  tags: z.array(z.string()).optional(),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const EntitySummarySchema = z.object({
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  summary: z.string().min(1),
  cueAnchors: z.array(z.string()),
  lastUpdated: TimestampSchema,
  embedding: EmbeddingSchema.optional(),
});
export type EntitySummary = z.infer<typeof EntitySummarySchema>;

export const ProfileDimensionSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  confidence: ConfidenceSchema,
  evidence: z.array(z.string()).optional(),
});
export type ProfileDimension = z.infer<typeof ProfileDimensionSchema>;

export const CallerProfileSchema = z.object({
  callerId: CallerIdSchema,
  dimensions: z.array(ProfileDimensionSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type CallerProfile = z.infer<typeof CallerProfileSchema>;

export const RetainInputSchema = z.object({
  callerId: CallerIdSchema,
  requestId: RequestIdSchema,
  content: z.string().min(1),
  timestamp: TimestampSchema,
  facts: z.array(FactTripleSchema).optional(),
  importance: ImportanceScoreSchema.optional(),
  tags: z.array(z.string()).optional(),
});
export type RetainInput = z.infer<typeof RetainInputSchema>;

export const RecallQuerySchema = z.object({
  callerId: CallerIdSchema,
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  threshold: ConfidenceSchema.optional(),
  tags: z.array(z.string()).optional(),
});
export type RecallQuery = z.infer<typeof RecallQuerySchema>;

export const RecallResultSchema = z.object({
  episodes: z.array(EpisodeSchema),
  facts: z.array(FactTripleSchema),
  totalFound: z.number().int().nonnegative(),
  queryEmbedding: EmbeddingSchema.optional(),
});
export type RecallResult = z.infer<typeof RecallResultSchema>;
