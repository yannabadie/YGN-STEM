import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryBeliefsStore } from "../networks/beliefs-store.js";
import type { CallerProfile } from "@ygn-stem/shared";

function makeProfile(overrides: Partial<CallerProfile> = {}): CallerProfile {
  return {
    callerId: "caller-alice",
    dimensions: [
      {
        key: "language",
        value: "TypeScript",
        confidence: 0.9,
        evidence: ["mentioned TS in req-1"],
      },
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("InMemoryBeliefsStore", () => {
  let store: InMemoryBeliefsStore;

  beforeEach(() => {
    store = new InMemoryBeliefsStore();
  });

  // ---- basic CRUD --------------------------------------------------------

  it("stores and retrieves a caller profile by callerId", async () => {
    const profile = makeProfile();
    await store.upsert(profile);
    const found = await store.getById("caller-alice");
    expect(found?.callerId).toBe("caller-alice");
    expect(found?.dimensions).toEqual(profile.dimensions);
  });

  it("returns undefined for unknown callerId", async () => {
    const found = await store.getById("ghost");
    expect(found).toBeUndefined();
  });

  it("counts stored profiles", async () => {
    expect(await store.count()).toBe(0);
    await store.upsert(makeProfile({ callerId: "a" }));
    await store.upsert(makeProfile({ callerId: "b" }));
    expect(await store.count()).toBe(2);
  });

  // ---- interaction counting ----------------------------------------------

  it("starts interactionCount at 1 on first upsert", async () => {
    const stored = await store.upsert(makeProfile());
    expect(stored.interactionCount).toBe(1);
  });

  it("increments interactionCount on each subsequent upsert", async () => {
    await store.upsert(makeProfile());
    const second = await store.upsert(makeProfile());
    expect(second.interactionCount).toBe(2);

    const third = await store.upsert(makeProfile());
    expect(third.interactionCount).toBe(3);
  });

  // ---- listCallerIds -----------------------------------------------------

  it("lists all known caller ids", async () => {
    await store.upsert(makeProfile({ callerId: "alice" }));
    await store.upsert(makeProfile({ callerId: "bob" }));
    const ids = await store.listCallerIds();
    expect(ids.sort()).toEqual(["alice", "bob"]);
  });

  it("returns empty array when no callers are stored", async () => {
    const ids = await store.listCallerIds();
    expect(ids).toEqual([]);
  });

  // ---- GDPR forget -------------------------------------------------------

  it("removes a caller profile on forgetCaller", async () => {
    await store.upsert(makeProfile());
    await store.forgetCaller("caller-alice");
    expect(await store.getById("caller-alice")).toBeUndefined();
    expect(await store.count()).toBe(0);
  });

  it("silently no-ops when forgetting a caller that does not exist", async () => {
    await expect(store.forgetCaller("ghost")).resolves.toBeUndefined();
    expect(await store.count()).toBe(0);
  });

  it("does not affect other callers when one is forgotten", async () => {
    await store.upsert(makeProfile({ callerId: "alice" }));
    await store.upsert(makeProfile({ callerId: "bob" }));
    await store.forgetCaller("alice");
    expect(await store.count()).toBe(1);
    expect(await store.getById("bob")).toBeDefined();
  });

  // ---- confidenceGate ----------------------------------------------------

  it("returns 0 for 0 interactions", () => {
    expect(InMemoryBeliefsStore.confidenceGate(0)).toBeCloseTo(0, 5);
  });

  it("returns 0.5 for 10 interactions (κ=10)", () => {
    expect(InMemoryBeliefsStore.confidenceGate(10)).toBeCloseTo(0.5, 5);
  });

  it("returns 0.9 for 90 interactions", () => {
    // 90 / (90 + 10) = 90 / 100 = 0.9
    expect(InMemoryBeliefsStore.confidenceGate(90)).toBeCloseTo(0.9, 5);
  });

  it("approaches 1 asymptotically for large n", () => {
    const gate = InMemoryBeliefsStore.confidenceGate(10_000);
    expect(gate).toBeGreaterThan(0.999);
    expect(gate).toBeLessThan(1);
  });

  it("is monotonically increasing", () => {
    const values = [0, 1, 5, 10, 50, 100].map(
      InMemoryBeliefsStore.confidenceGate,
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!);
    }
  });
});
