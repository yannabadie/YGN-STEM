import { z } from "zod";

export const OrganStatusSchema = z.enum([
  "healthy",
  "degraded",
  "unavailable",
  "unknown",
]);
export type OrganStatus = z.infer<typeof OrganStatusSchema>;

export const TransportTypeSchema = z.enum([
  "http",
  "grpc",
  "stdio",
  "websocket",
]);
export type TransportType = z.infer<typeof TransportTypeSchema>;

export const OrganConfigSchema = z.object({
  organId: z.string().min(1),
  transport: TransportTypeSchema,
  endpoint: z.string().min(1),
  timeoutMs: z.number().int().positive(),
  retries: z.number().int().nonnegative().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type OrganConfig = z.infer<typeof OrganConfigSchema>;

export const OrganInfoSchema = z.object({
  organId: z.string().min(1),
  name: z.string().min(1),
  status: OrganStatusSchema,
  transport: TransportTypeSchema,
  version: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
  lastHealthCheck: z.string().optional(),
});
export type OrganInfo = z.infer<typeof OrganInfoSchema>;

export const ToolDescriptorSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
});
export type ToolDescriptor = z.infer<typeof ToolDescriptorSchema>;
