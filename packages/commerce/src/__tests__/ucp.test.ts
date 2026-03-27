import { describe, it, expect, beforeEach } from "vitest";
import { UcpSessionStore } from "../ucp.js";
import type { UcpItem } from "../ucp.js";

const sampleItems: UcpItem[] = [
  { name: "STEM Textbook", quantity: 2, unitPrice: 25 },
  { name: "Lab Kit", quantity: 1, unitPrice: 50 },
];

describe("UcpSessionStore", () => {
  let store: UcpSessionStore;

  beforeEach(() => {
    store = new UcpSessionStore();
  });

  // ---- createSession -------------------------------------------------------

  it("creates a checkout session with items and correct total", () => {
    const session = store.createSession({
      items: sampleItems,
      currency: "USD",
      idempotencyKey: "key-001",
    });

    expect(session.id).toBeTruthy();
    expect(session.status).toBe("created");
    expect(session.currency).toBe("USD");
    expect(session.items).toHaveLength(2);
    // total = 2*25 + 1*50 = 100
    expect(session.total).toBe(100);
    expect(session.idempotencyKey).toBe("key-001");
    expect(session.createdAt).toBeTruthy();
    expect(session.completedAt).toBeUndefined();
  });

  it("computes total correctly from items (sum of quantity * unitPrice)", () => {
    const session = store.createSession({
      items: [
        { name: "Item A", quantity: 3, unitPrice: 10 },
        { name: "Item B", quantity: 2, unitPrice: 15 },
        { name: "Item C", quantity: 1, unitPrice: 5 },
      ],
      currency: "EUR",
      idempotencyKey: "key-total",
    });

    // total = 3*10 + 2*15 + 1*5 = 30 + 30 + 5 = 65
    expect(session.total).toBe(65);
  });

  // ---- idempotency ---------------------------------------------------------

  it("returns the same session when the same idempotency key is used", () => {
    const first = store.createSession({
      items: sampleItems,
      currency: "USD",
      idempotencyKey: "key-idempotent",
    });

    const second = store.createSession({
      items: sampleItems,
      currency: "USD",
      idempotencyKey: "key-idempotent",
    });

    expect(second.id).toBe(first.id);
    expect(store.listSessions()).toHaveLength(1);
  });

  it("creates distinct sessions for different idempotency keys", () => {
    store.createSession({ items: sampleItems, currency: "USD", idempotencyKey: "key-A" });
    store.createSession({ items: sampleItems, currency: "USD", idempotencyKey: "key-B" });

    expect(store.listSessions()).toHaveLength(2);
  });

  // ---- getSession ----------------------------------------------------------

  it("retrieves a session by id", () => {
    const created = store.createSession({
      items: sampleItems,
      currency: "GBP",
      idempotencyKey: "key-get",
    });

    const found = store.getSession(created.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
    expect(found?.currency).toBe("GBP");
  });

  it("returns undefined for an unknown session id", () => {
    expect(store.getSession("non-existent-id")).toBeUndefined();
  });

  // ---- completeSession -----------------------------------------------------

  it("completes a session and records completedAt", () => {
    const session = store.createSession({
      items: sampleItems,
      currency: "USD",
      idempotencyKey: "key-complete",
    });

    const completed = store.completeSession(session.id);

    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();

    // Persisted in the store
    const fetched = store.getSession(session.id);
    expect(fetched?.status).toBe("completed");
  });

  it("rejects completing an already-completed session", () => {
    const session = store.createSession({
      items: sampleItems,
      currency: "USD",
      idempotencyKey: "key-double-complete",
    });

    store.completeSession(session.id);

    expect(() => store.completeSession(session.id)).toThrow();
  });

  it("throws when completing a non-existent session", () => {
    expect(() => store.completeSession("ghost-session")).toThrow();
  });

  // ---- listSessions --------------------------------------------------------

  it("listSessions returns all sessions", () => {
    store.createSession({ items: sampleItems, currency: "USD", idempotencyKey: "k1" });
    store.createSession({ items: sampleItems, currency: "EUR", idempotencyKey: "k2" });
    store.createSession({ items: sampleItems, currency: "GBP", idempotencyKey: "k3" });

    expect(store.listSessions()).toHaveLength(3);
  });

  it("listSessions returns empty array when no sessions exist", () => {
    expect(store.listSessions()).toHaveLength(0);
  });
});
