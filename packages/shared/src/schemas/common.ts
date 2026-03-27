import { z } from "zod";

export const RequestIdSchema = z.string().min(1);
export type RequestId = z.infer<typeof RequestIdSchema>;

export const CallerIdSchema = z.string().min(1);
export type CallerId = z.infer<typeof CallerIdSchema>;

export const TimestampSchema = z.iso.datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

export const OutcomeSchema = z.enum(["success", "failure", "partial"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const EmbeddingSchema = z.array(z.number());
export type Embedding = z.infer<typeof EmbeddingSchema>;

export const ImportanceScoreSchema = z.number().min(0).max(1);
export type ImportanceScore = z.infer<typeof ImportanceScoreSchema>;

export const ConfidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof ConfidenceSchema>;
