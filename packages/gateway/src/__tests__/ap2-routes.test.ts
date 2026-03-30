import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { Ap2Store } from "@ygn-stem/commerce";
import { createAp2Router } from "../routes/ap2.js";

// ---------------------------------------------------------------------------
// Helper: build a minimal express app with AP2 routes
// ---------------------------------------------------------------------------
function buildApp(store: Ap2Store) {
  const app = express();
  app.use(express.json());
  app.use(createAp2Router(store));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("AP2 routes", () => {
  let store: Ap2Store;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    store = new Ap2Store();
    app = buildApp(store);
  });

  // ---- POST /ap2/intents ---------------------------------------------------

  it("POST /ap2/intents creates an intent with status pending and returns 201", async () => {
    const res = await request(app)
      .post("/ap2/intents")
      .send({ amount: 500, currency: "USD", description: "Service fee" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.amount).toBe(500);
    expect(res.body.currency).toBe("USD");
    expect(res.body.id).toBeDefined();
  });

  it("POST /ap2/intents auto-approves when amount is at or below threshold", async () => {
    const res = await request(app)
      .post("/ap2/intents")
      .send({
        amount: 100,
        currency: "USD",
        description: "Small charge",
        autoApproveThreshold: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("approved");
  });

  // ---- GET /ap2/intents/:id ------------------------------------------------

  it("GET /ap2/intents/:id retrieves the intent with 200", async () => {
    const create = await request(app)
      .post("/ap2/intents")
      .send({ amount: 200, currency: "EUR", description: "Test" });

    const id = create.body.id as string;
    const res = await request(app).get(`/ap2/intents/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it("GET /ap2/intents/:id returns 404 for unknown intent", async () => {
    const res = await request(app).get("/ap2/intents/ghost-intent");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  // ---- POST /ap2/intents/:id/approve --------------------------------------

  it("POST /ap2/intents/:id/approve creates a mandate and returns 201", async () => {
    const create = await request(app)
      .post("/ap2/intents")
      .send({ amount: 300, currency: "USD", description: "Approval test" });

    const id = create.body.id as string;
    const res = await request(app)
      .post(`/ap2/intents/${id}/approve`)
      .send({ approvedBy: "ops-team" });

    expect(res.status).toBe(201);
    expect(res.body.intentId).toBe(id);
    expect(res.body.status).toBe("pending");
    expect(res.body.approvedBy).toBe("ops-team");
  });

  it("POST /ap2/intents/:id/approve returns 404 for unknown intent", async () => {
    const res = await request(app)
      .post("/ap2/intents/no-such-intent/approve")
      .send({ approvedBy: "me" });
    expect(res.status).toBe(404);
  });

  it("POST /ap2/intents/:id/approve returns 400 when intent is not pending", async () => {
    const create = await request(app)
      .post("/ap2/intents")
      .send({ amount: 100, currency: "USD", description: "Already approved", autoApproveThreshold: 999 });

    const id = create.body.id as string;
    // intent is already "approved" due to auto-approve
    const res = await request(app)
      .post(`/ap2/intents/${id}/approve`)
      .send({ approvedBy: "human" });

    expect(res.status).toBe(400);
  });

  // ---- POST /ap2/intents/:id/reject ----------------------------------------

  it("POST /ap2/intents/:id/reject rejects a pending intent and returns 200", async () => {
    const create = await request(app)
      .post("/ap2/intents")
      .send({ amount: 999, currency: "USD", description: "Big charge" });

    const id = create.body.id as string;
    const res = await request(app)
      .post(`/ap2/intents/${id}/reject`)
      .send({ reason: "Too expensive" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
  });

  it("POST /ap2/intents/:id/reject returns 404 for unknown intent", async () => {
    const res = await request(app)
      .post("/ap2/intents/nope/reject")
      .send({ reason: "gone" });
    expect(res.status).toBe(404);
  });

  // ---- POST /ap2/mandates/:id/execute --------------------------------------

  it("POST /ap2/mandates/:id/execute creates a receipt and returns 201", async () => {
    // Create and approve intent to get mandate
    const create = await request(app)
      .post("/ap2/intents")
      .send({ amount: 50, currency: "USD", description: "Execute test" });

    const intentId = create.body.id as string;
    const approve = await request(app)
      .post(`/ap2/intents/${intentId}/approve`)
      .send({ approvedBy: "manager" });

    const mandateId = approve.body.id as string;
    const res = await request(app).post(`/ap2/mandates/${mandateId}/execute`);

    expect(res.status).toBe(201);
    expect(res.body.mandateId).toBe(mandateId);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.transactionRef).toBeDefined();
  });

  it("POST /ap2/mandates/:id/execute returns 404 for unknown mandate", async () => {
    const res = await request(app).post("/ap2/mandates/ghost-mandate/execute");
    expect(res.status).toBe(404);
  });

  // ---- GET /ap2/audit ------------------------------------------------------

  it("GET /ap2/audit returns the full audit trail", async () => {
    await request(app)
      .post("/ap2/intents")
      .send({ amount: 100, currency: "USD", description: "Audit test" });

    const res = await request(app).get("/ap2/audit");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("GET /ap2/audit?intentId= filters entries to that intent", async () => {
    const c1 = await request(app)
      .post("/ap2/intents")
      .send({ amount: 10, currency: "USD", description: "Intent A" });
    await request(app)
      .post("/ap2/intents")
      .send({ amount: 20, currency: "USD", description: "Intent B" });

    const intentId = c1.body.id as string;
    const res = await request(app).get(`/ap2/audit?intentId=${intentId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Every entry must relate to intentId
    for (const entry of res.body as Array<{ entityId: string }>) {
      expect(entry.entityId).toBe(intentId);
    }
  });

  // ---- Full lifecycle: intent → approve → execute → receipt ---------------

  it("full lifecycle: intent → approve → execute → receipt", async () => {
    // 1. Create intent
    const createRes = await request(app)
      .post("/ap2/intents")
      .send({ amount: 75, currency: "GBP", description: "Full lifecycle" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe("pending");
    const intentId = createRes.body.id as string;

    // 2. Approve intent → get mandate
    const approveRes = await request(app)
      .post(`/ap2/intents/${intentId}/approve`)
      .send({ approvedBy: "supervisor" });
    expect(approveRes.status).toBe(201);
    const mandateId = approveRes.body.id as string;

    // 3. Verify intent is now approved
    const intentRes = await request(app).get(`/ap2/intents/${intentId}`);
    expect(intentRes.status).toBe(200);
    expect(intentRes.body.status).toBe("approved");

    // 4. Execute mandate → get receipt
    const executeRes = await request(app).post(`/ap2/mandates/${mandateId}/execute`);
    expect(executeRes.status).toBe(201);
    expect(executeRes.body.mandateId).toBe(mandateId);
    expect(executeRes.body.status).toBe("confirmed");
    expect(executeRes.body.amount).toBe(75);
    expect(executeRes.body.currency).toBe("GBP");

    // 5. Audit trail for this intent should have multiple entries
    const auditRes = await request(app).get(`/ap2/audit?intentId=${intentId}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.length).toBeGreaterThanOrEqual(2);
  });
});
