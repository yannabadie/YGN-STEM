import { describe, it, expect, beforeEach } from "vitest";
import { Ap2Store } from "../ap2.js";

describe("Ap2Store", () => {
  let store: Ap2Store;

  beforeEach(() => {
    store = new Ap2Store();
  });

  // ---- createIntent --------------------------------------------------------

  it("creates a payment intent with pending status", () => {
    const intent = store.createIntent({
      amount: 100,
      currency: "USD",
      description: "STEM course enrollment",
    });

    expect(intent.id).toBeTruthy();
    expect(intent.status).toBe("pending");
    expect(intent.amount).toBe(100);
    expect(intent.currency).toBe("USD");
    expect(intent.description).toBe("STEM course enrollment");
    expect(intent.createdAt).toBeTruthy();
  });

  // ---- auto-approve --------------------------------------------------------

  it("auto-approves intent when amount is at or below autoApproveThreshold", () => {
    const intent = store.createIntent({
      amount: 50,
      currency: "USD",
      description: "Small purchase",
      autoApproveThreshold: 100,
    });

    expect(intent.status).toBe("approved");
  });

  it("auto-approves when amount equals threshold exactly", () => {
    const intent = store.createIntent({
      amount: 100,
      currency: "USD",
      description: "Exact threshold",
      autoApproveThreshold: 100,
    });

    expect(intent.status).toBe("approved");
  });

  it("does NOT auto-approve when amount exceeds autoApproveThreshold", () => {
    const intent = store.createIntent({
      amount: 150,
      currency: "USD",
      description: "Large purchase",
      autoApproveThreshold: 100,
    });

    expect(intent.status).toBe("pending");
  });

  it("does NOT auto-approve when no threshold is set", () => {
    const intent = store.createIntent({
      amount: 10,
      currency: "USD",
      description: "No threshold set",
    });

    expect(intent.status).toBe("pending");
  });

  it("auto-approve creates a mandate automatically", () => {
    const intent = store.createIntent({
      amount: 50,
      currency: "USD",
      description: "Auto mandate test",
      autoApproveThreshold: 100,
    });

    // The auto-created mandate should reference the intent
    const allMandates = [...store["mandates"].values()];
    expect(allMandates.some((m) => m.intentId === intent.id)).toBe(true);
  });

  // ---- approveIntent -------------------------------------------------------

  it("approves a pending intent and creates a mandate", () => {
    const intent = store.createIntent({
      amount: 200,
      currency: "USD",
      description: "Manual approval",
    });

    const mandate = store.approveIntent(intent.id, "admin-user");

    expect(mandate.intentId).toBe(intent.id);
    expect(mandate.status).toBe("pending");
    expect(mandate.approvedBy).toBe("admin-user");
    expect(mandate.amount).toBe(200);
    expect(mandate.currency).toBe("USD");

    const updated = store.getIntent(intent.id);
    expect(updated?.status).toBe("approved");
  });

  it("throws when approving a non-existent intent", () => {
    expect(() => store.approveIntent("ghost-intent", "user")).toThrow();
  });

  it("throws when approving an already-approved intent", () => {
    const intent = store.createIntent({
      amount: 50,
      currency: "USD",
      description: "Already approved",
      autoApproveThreshold: 100,
    });

    expect(() => store.approveIntent(intent.id, "user")).toThrow();
  });

  // ---- rejectIntent --------------------------------------------------------

  it("rejects a pending intent", () => {
    const intent = store.createIntent({
      amount: 500,
      currency: "USD",
      description: "Suspicious transaction",
    });

    const rejected = store.rejectIntent(intent.id, "fraud detected");

    expect(rejected.status).toBe("rejected");

    const fetched = store.getIntent(intent.id);
    expect(fetched?.status).toBe("rejected");
  });

  it("throws when rejecting a non-existent intent", () => {
    expect(() => store.rejectIntent("ghost-intent", "reason")).toThrow();
  });

  it("throws when rejecting an already-rejected intent", () => {
    const intent = store.createIntent({
      amount: 500,
      currency: "USD",
      description: "Double reject",
    });
    store.rejectIntent(intent.id, "first rejection");

    expect(() => store.rejectIntent(intent.id, "second rejection")).toThrow();
  });

  // ---- executeMandate ------------------------------------------------------

  it("executes a mandate and creates a receipt", () => {
    const intent = store.createIntent({
      amount: 75,
      currency: "EUR",
      description: "Execute test",
    });
    const mandate = store.approveIntent(intent.id, "finance-team");

    const receipt = store.executeMandate(mandate.id);

    expect(receipt.mandateId).toBe(mandate.id);
    expect(receipt.status).toBe("confirmed");
    expect(receipt.transactionRef).toBeTruthy();
    expect(receipt.amount).toBe(75);
    expect(receipt.currency).toBe("EUR");
    expect(receipt.createdAt).toBeTruthy();

    const updatedMandate = store.getMandate(mandate.id);
    expect(updatedMandate?.status).toBe("executed");
    expect(updatedMandate?.executedAt).toBeTruthy();
  });

  it("throws when executing a non-existent mandate", () => {
    expect(() => store.executeMandate("ghost-mandate")).toThrow();
  });

  it("throws when executing an already-executed mandate", () => {
    const intent = store.createIntent({
      amount: 75,
      currency: "EUR",
      description: "Double execute",
    });
    const mandate = store.approveIntent(intent.id, "user");
    store.executeMandate(mandate.id);

    expect(() => store.executeMandate(mandate.id)).toThrow();
  });

  // ---- full lifecycle ------------------------------------------------------

  it("completes the full lifecycle: intent → approve → mandate → execute → receipt", () => {
    // Phase 1: create intent
    const intent = store.createIntent({
      amount: 300,
      currency: "USD",
      description: "Full lifecycle test",
    });
    expect(intent.status).toBe("pending");

    // Phase 2: approve → mandate
    const mandate = store.approveIntent(intent.id, "supervisor");
    expect(mandate.intentId).toBe(intent.id);
    expect(mandate.status).toBe("pending");

    // Phase 3: execute → receipt
    const receipt = store.executeMandate(mandate.id);
    expect(receipt.status).toBe("confirmed");
    expect(receipt.transactionRef).toBeTruthy();

    // Verify final states
    expect(store.getIntent(intent.id)?.status).toBe("approved");
    expect(store.getMandate(mandate.id)?.status).toBe("executed");
    expect(store.getReceipt(receipt.id)?.status).toBe("confirmed");
  });

  // ---- audit trail ---------------------------------------------------------

  it("audit trail records all actions for a full lifecycle", () => {
    const intent = store.createIntent({
      amount: 100,
      currency: "USD",
      description: "Audit test",
    });
    const mandate = store.approveIntent(intent.id, "auditor");
    store.executeMandate(mandate.id);

    const trail = store.getAuditTrail();

    const actions = trail.map((e) => e.action);
    expect(actions).toContain("intent_created");
    expect(actions).toContain("intent_approved");
    expect(actions).toContain("mandate_created");
    expect(actions).toContain("mandate_executed");
    expect(actions).toContain("receipt_created");

    // All entries have timestamps
    for (const entry of trail) {
      expect(entry.timestamp).toBeTruthy();
      expect(entry.entityId).toBeTruthy();
    }
  });

  it("audit trail filtered by intentId returns only related entries", () => {
    const intentA = store.createIntent({ amount: 50, currency: "USD", description: "A" });
    const intentB = store.createIntent({ amount: 75, currency: "USD", description: "B" });

    const mandateA = store.approveIntent(intentA.id, "user");
    store.approveIntent(intentB.id, "user");

    store.executeMandate(mandateA.id);

    const trailA = store.getAuditTrail(intentA.id);
    const trailB = store.getAuditTrail(intentB.id);

    // Trail A should include intent_created, intent_approved, mandate_created,
    // mandate_executed, receipt_created — all for intent A's chain.
    expect(trailA.length).toBeGreaterThan(0);
    expect(trailB.length).toBeGreaterThan(0);

    // Trail A should not include entries for intent B's id
    const trailAEntityIds = trailA.map((e) => e.entityId);
    expect(trailAEntityIds).not.toContain(intentB.id);
  });

  it("getAuditTrail returns all entries when no intentId is provided", () => {
    store.createIntent({ amount: 10, currency: "USD", description: "X" });
    store.createIntent({ amount: 20, currency: "USD", description: "Y" });

    const all = store.getAuditTrail();
    expect(all.length).toBe(2); // two intent_created entries
  });

  it("audit trail records auto-approve actions", () => {
    store.createIntent({
      amount: 10,
      currency: "USD",
      description: "Auto",
      autoApproveThreshold: 50,
    });

    const trail = store.getAuditTrail();
    const actions = trail.map((e) => e.action);
    expect(actions).toContain("intent_auto_approved");
    expect(actions).toContain("mandate_created");
  });

  // ---- lookups -------------------------------------------------------------

  it("getIntent returns undefined for unknown id", () => {
    expect(store.getIntent("unknown")).toBeUndefined();
  });

  it("getMandate returns undefined for unknown id", () => {
    expect(store.getMandate("unknown")).toBeUndefined();
  });

  it("getReceipt returns undefined for unknown id", () => {
    expect(store.getReceipt("unknown")).toBeUndefined();
  });
});
