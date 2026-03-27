import { z } from "zod";

// ---------------------------------------------------------------------------
// UCP — Universal Commerce Protocol
// ---------------------------------------------------------------------------

export const UcpItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});
export type UcpItem = z.infer<typeof UcpItemSchema>;

export const UcpSessionStatusSchema = z.enum(["created", "completed", "expired"]);
export type UcpSessionStatus = z.infer<typeof UcpSessionStatusSchema>;

export const UcpSessionSchema = z.object({
  id: z.string().min(1),
  status: UcpSessionStatusSchema,
  items: z.array(UcpItemSchema),
  total: z.number().nonnegative(),
  currency: z.string().min(1),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().min(1),
});
export type UcpSession = z.infer<typeof UcpSessionSchema>;

// ---------------------------------------------------------------------------
// AP2 — Agent Payments Protocol
// ---------------------------------------------------------------------------

export const PaymentIntentStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type PaymentIntentStatus = z.infer<typeof PaymentIntentStatusSchema>;

export const PaymentIntentSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  description: z.string(),
  autoApproveThreshold: z.number().positive().optional(),
  status: PaymentIntentStatusSchema,
  createdAt: z.string().datetime(),
});
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;

export const PaymentMandateStatusSchema = z.enum(["pending", "executed", "failed"]);
export type PaymentMandateStatus = z.infer<typeof PaymentMandateStatusSchema>;

export const PaymentMandateSchema = z.object({
  id: z.string().min(1),
  intentId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  status: PaymentMandateStatusSchema,
  approvedBy: z.string().optional(),
  createdAt: z.string().datetime(),
  executedAt: z.string().datetime().optional(),
});
export type PaymentMandate = z.infer<typeof PaymentMandateSchema>;

export const PaymentReceiptSchema = z.object({
  id: z.string().min(1),
  mandateId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  status: z.literal("confirmed"),
  transactionRef: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type PaymentReceipt = z.infer<typeof PaymentReceiptSchema>;
