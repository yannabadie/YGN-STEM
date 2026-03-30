import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { UcpSessionStore } from "@ygn-stem/commerce";
import { createUcpRouter } from "../routes/ucp.js";

// ---------------------------------------------------------------------------
// Helper: build a minimal express app with UCP routes
// ---------------------------------------------------------------------------
function buildApp(store: UcpSessionStore) {
  const app = express();
  app.use(express.json());
  app.use(createUcpRouter(store));
  return app;
}

// Sample items payload
const ITEMS = [
  { sku: "item-1", name: "Widget", quantity: 2, unitPrice: 10.0 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("UCP routes", () => {
  let store: UcpSessionStore;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    store = new UcpSessionStore();
    app = buildApp(store);
  });

  // ---- POST /ucp/sessions ---------------------------------------------------

  it("POST /ucp/sessions creates a session and returns 201", async () => {
    const res = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "key-001")
      .send({ items: ITEMS, currency: "USD" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("created");
    expect(res.body.total).toBe(20);
    expect(res.body.currency).toBe("USD");
    expect(res.body.id).toBeDefined();
    expect(res.body.idempotencyKey).toBe("key-001");
  });

  it("same Idempotency-Key returns same session (idempotency)", async () => {
    const res1 = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "key-idem")
      .send({ items: ITEMS, currency: "USD" });

    const res2 = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "key-idem")
      .send({ items: ITEMS, currency: "USD" });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.id).toBe(res2.body.id);
  });

  it("POST /ucp/sessions returns 400 when Idempotency-Key header is missing", async () => {
    const res = await request(app)
      .post("/ucp/sessions")
      .send({ items: ITEMS, currency: "USD" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Idempotency-Key/);
  });

  // ---- GET /ucp/sessions/:id -----------------------------------------------

  it("GET /ucp/sessions/:id retrieves a session with 200", async () => {
    const create = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "key-get")
      .send({ items: ITEMS, currency: "EUR" });

    const id = create.body.id as string;
    const res = await request(app).get(`/ucp/sessions/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.currency).toBe("EUR");
  });

  it("GET /ucp/sessions/:id returns 404 for unknown session", async () => {
    const res = await request(app).get("/ucp/sessions/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  // ---- POST /ucp/sessions/:id/complete -------------------------------------

  it("POST /ucp/sessions/:id/complete completes the session and returns 200", async () => {
    const create = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "key-complete")
      .send({ items: ITEMS, currency: "USD" });

    const id = create.body.id as string;
    const res = await request(app).post(`/ucp/sessions/${id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.completedAt).toBeDefined();
  });

  it("POST /ucp/sessions/:id/complete returns 404 for unknown session", async () => {
    const res = await request(app).post("/ucp/sessions/ghost-id/complete");
    expect(res.status).toBe(404);
  });

  it("POST /ucp/sessions/:id/complete returns 400 when session is already completed", async () => {
    const create = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "key-double-complete")
      .send({ items: ITEMS, currency: "USD" });

    const id = create.body.id as string;
    await request(app).post(`/ucp/sessions/${id}/complete`);

    const res = await request(app).post(`/ucp/sessions/${id}/complete`);
    expect(res.status).toBe(400);
  });
});
