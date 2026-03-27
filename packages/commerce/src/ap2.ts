// ---------------------------------------------------------------------------
// AP2 — Agent Payments Protocol
// 3-phase payment lifecycle: Intent → Mandate → Receipt.
// ---------------------------------------------------------------------------

import type { PaymentIntent, PaymentMandate, PaymentReceipt } from "@ygn-stem/shared";
export type { PaymentIntent, PaymentMandate, PaymentReceipt };

export interface AuditEntry {
  action: string;
  entityId: string;
  timestamp: string;
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _counter = 0;

function generateId(prefix: string): string {
  _counter += 1;
  return `${prefix}-${Date.now()}-${_counter}`;
}

// ---------------------------------------------------------------------------
// Ap2Store
// ---------------------------------------------------------------------------

export class Ap2Store {
  private readonly intents = new Map<string, PaymentIntent>();
  private readonly mandates = new Map<string, PaymentMandate>();
  private readonly receipts = new Map<string, PaymentReceipt>();
  private readonly auditTrail: AuditEntry[] = [];

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private audit(
    action: string,
    entityId: string,
    details: Record<string, unknown> = {},
  ): void {
    this.auditTrail.push({
      action,
      entityId,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  private createMandate(intent: PaymentIntent, approvedBy?: string): PaymentMandate {
    const mandate: PaymentMandate = {
      id: generateId("mandate"),
      intentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: "pending",
      approvedBy,
      createdAt: new Date().toISOString(),
    };
    this.mandates.set(mandate.id, mandate);
    this.audit("mandate_created", mandate.id, {
      intentId: intent.id,
      approvedBy,
    });
    return mandate;
  }

  // -------------------------------------------------------------------------
  // createIntent — phase 1: create a payment intent
  // -------------------------------------------------------------------------

  createIntent(input: {
    amount: number;
    currency: string;
    description: string;
    autoApproveThreshold?: number;
  }): PaymentIntent {
    const id = generateId("intent");
    const intent: PaymentIntent = {
      id,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      autoApproveThreshold: input.autoApproveThreshold,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    this.intents.set(id, intent);
    this.audit("intent_created", id, {
      amount: input.amount,
      currency: input.currency,
    });

    // Auto-approve if amount is at or below threshold.
    if (
      input.autoApproveThreshold !== undefined &&
      input.amount <= input.autoApproveThreshold
    ) {
      const approved: PaymentIntent = { ...intent, status: "approved" };
      this.intents.set(id, approved);
      this.audit("intent_auto_approved", id, {
        threshold: input.autoApproveThreshold,
      });
      this.createMandate(approved, "auto");
      return approved;
    }

    return intent;
  }

  // -------------------------------------------------------------------------
  // approveIntent — manually approve an intent and create a mandate
  // -------------------------------------------------------------------------

  approveIntent(id: string, approvedBy: string): PaymentMandate {
    const intent = this.intents.get(id);
    if (intent === undefined) {
      throw new Error(`Intent not found: ${id}`);
    }
    if (intent.status !== "pending") {
      throw new Error(`Intent is not pending: ${id} (status: ${intent.status})`);
    }

    const approved: PaymentIntent = { ...intent, status: "approved" };
    this.intents.set(id, approved);
    this.audit("intent_approved", id, { approvedBy });

    return this.createMandate(approved, approvedBy);
  }

  // -------------------------------------------------------------------------
  // rejectIntent — reject a pending intent
  // -------------------------------------------------------------------------

  rejectIntent(id: string, reason: string): PaymentIntent {
    const intent = this.intents.get(id);
    if (intent === undefined) {
      throw new Error(`Intent not found: ${id}`);
    }
    if (intent.status !== "pending") {
      throw new Error(`Intent is not pending: ${id} (status: ${intent.status})`);
    }

    const rejected: PaymentIntent = { ...intent, status: "rejected" };
    this.intents.set(id, rejected);
    this.audit("intent_rejected", id, { reason });

    return rejected;
  }

  // -------------------------------------------------------------------------
  // executeMandate — phase 2 → 3: execute mandate and create receipt
  // -------------------------------------------------------------------------

  executeMandate(mandateId: string): PaymentReceipt {
    const mandate = this.mandates.get(mandateId);
    if (mandate === undefined) {
      throw new Error(`Mandate not found: ${mandateId}`);
    }
    if (mandate.status !== "pending") {
      throw new Error(
        `Mandate is not pending: ${mandateId} (status: ${mandate.status})`,
      );
    }

    const executedAt = new Date().toISOString();
    const executed: PaymentMandate = {
      ...mandate,
      status: "executed",
      executedAt,
    };
    this.mandates.set(mandateId, executed);
    this.audit("mandate_executed", mandateId, { executedAt });

    const transactionRef = generateId("txn");
    const receipt: PaymentReceipt = {
      id: generateId("receipt"),
      mandateId,
      amount: mandate.amount,
      currency: mandate.currency,
      status: "confirmed",
      transactionRef,
      createdAt: new Date().toISOString(),
    };
    this.receipts.set(receipt.id, receipt);
    this.audit("receipt_created", receipt.id, {
      mandateId,
      transactionRef,
    });

    return receipt;
  }

  // -------------------------------------------------------------------------
  // Lookups
  // -------------------------------------------------------------------------

  getIntent(id: string): PaymentIntent | undefined {
    return this.intents.get(id);
  }

  getMandate(id: string): PaymentMandate | undefined {
    return this.mandates.get(id);
  }

  getReceipt(id: string): PaymentReceipt | undefined {
    return this.receipts.get(id);
  }

  // -------------------------------------------------------------------------
  // getAuditTrail — return all audit entries, optionally filtered by intentId
  // -------------------------------------------------------------------------

  getAuditTrail(intentId?: string): AuditEntry[] {
    if (intentId === undefined) return [...this.auditTrail];

    // Collect all entity IDs associated with the intent.
    const relatedIds = new Set<string>([intentId]);

    for (const mandate of this.mandates.values()) {
      if (mandate.intentId === intentId) {
        relatedIds.add(mandate.id);
        // Also collect receipts referencing this mandate.
        for (const receipt of this.receipts.values()) {
          if (receipt.mandateId === mandate.id) {
            relatedIds.add(receipt.id);
          }
        }
      }
    }

    return this.auditTrail.filter((entry) => relatedIds.has(entry.entityId));
  }
}
