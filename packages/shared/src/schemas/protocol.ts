import { z } from "zod";

export const A2ATaskStateSchema = z.enum([
  "submitted",
  "working",
  "completed",
  "failed",
  "canceled",
]);
export type A2ATaskState = z.infer<typeof A2ATaskStateSchema>;

export const A2ATaskSchema = z.object({
  id: z.string().min(1),
  state: A2ATaskStateSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type A2ATask = z.infer<typeof A2ATaskSchema>;

export const AgentCardSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  version: z.string().min(1),
  url: z.string().min(1),
  capabilities: z.array(z.string()),
  skills: z.array(z.string()).optional(),
  contact: z.string().optional(),
});
export type AgentCard = z.infer<typeof AgentCardSchema>;

export const AgUiEventTypeSchema = z.enum([
  "run_started",
  "run_finished",
  "run_error",
  "text_message_start",
  "text_message_content",
  "text_message_end",
  "tool_call_start",
  "tool_call_end",
]);
export type AgUiEventType = z.infer<typeof AgUiEventTypeSchema>;

export const AgUiEventSchema = z.object({
  type: AgUiEventTypeSchema,
  timestamp: z.iso.datetime(),
  runId: z.string().optional(),
  data: z.unknown().optional(),
});
export type AgUiEvent = z.infer<typeof AgUiEventSchema>;

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string().min(1),
  id: z.union([z.string(), z.number()]),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export const JsonRpcErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>;

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.optional(),
});
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;
