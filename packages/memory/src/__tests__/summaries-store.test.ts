import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySummariesStore } from "../networks/summaries-store.js";
import type { EntitySummary } from "@ygn-stem/shared";

function makeSummary(overrides: Partial<EntitySummary> = {}): EntitySummary {
  return {
    entityId: "entity-1",
    entityType: "person",
    summary: "Alice is a software engineer who loves Rust",
    cueAnchors: ["Alice", "software engineer", "Rust"],
    lastUpdated: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("InMemorySummariesStore", () => {
  let store: InMemorySummariesStore;

  beforeEach(() => {
    store = new InMemorySummariesStore();
  });

  // ---- basic CRUD --------------------------------------------------------

  it("stores and retrieves a summary by entityId", async () => {
    const s = makeSummary();
    const stored = await store.upsert(s);
    const found = await store.getById("entity-1");
    expect(found).toEqual(stored);
  });

  it("returns undefined for unknown entityId", async () => {
    const found = await store.getById("ghost");
    expect(found).toBeUndefined();
  });

  it("counts stored summaries", async () => {
    expect(await store.count()).toBe(0);
    await store.upsert(makeSummary({ entityId: "a" }));
    await store.upsert(makeSummary({ entityId: "b" }));
    expect(await store.count()).toBe(2);
  });

  // ---- version increment on update ---------------------------------------

  it("starts at version 1 for a new summary", async () => {
    const stored = await store.upsert(makeSummary());
    expect(stored.version).toBe(1);
  });

  it("increments version on each subsequent upsert", async () => {
    await store.upsert(makeSummary());
    const v2 = await store.upsert(makeSummary({ summary: "Updated summary" }));
    expect(v2.version).toBe(2);

    const v3 = await store.upsert(makeSummary({ summary: "Updated again" }));
    expect(v3.version).toBe(3);
  });

  it("reflects the latest content after an update", async () => {
    await store.upsert(makeSummary({ summary: "Original" }));
    await store.upsert(makeSummary({ summary: "Revised" }));
    const found = await store.getById("entity-1");
    expect(found?.summary).toBe("Revised");
  });

  // ---- searchByCueAnchor -------------------------------------------------

  it("finds summaries whose cueAnchors contain a matching anchor (case-insensitive)", async () => {
    await store.upsert(
      makeSummary({ entityId: "a", cueAnchors: ["Alice", "software"] }),
    );
    await store.upsert(
      makeSummary({ entityId: "b", cueAnchors: ["Bob", "hardware"] }),
    );

    const results = await store.searchByCueAnchor("alice");
    expect(results).toHaveLength(1);
    expect(results[0]?.entityId).toBe("a");
  });

  it("performs substring matching on cue anchors", async () => {
    await store.upsert(
      makeSummary({ entityId: "a", cueAnchors: ["software engineer"] }),
    );
    const results = await store.searchByCueAnchor("ware eng");
    expect(results).toHaveLength(1);
  });

  it("returns empty array when no cue anchor matches", async () => {
    await store.upsert(makeSummary({ entityId: "a", cueAnchors: ["Alice"] }));
    const results = await store.searchByCueAnchor("Zara");
    expect(results).toHaveLength(0);
  });

  // ---- searchByType ------------------------------------------------------

  it("filters summaries by entity type", async () => {
    await store.upsert(makeSummary({ entityId: "alice", entityType: "person" }));
    await store.upsert(
      makeSummary({ entityId: "acme", entityType: "organization" }),
    );

    const persons = await store.searchByType("person");
    expect(persons).toHaveLength(1);
    expect(persons[0]?.entityId).toBe("alice");

    const orgs = await store.searchByType("organization");
    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.entityId).toBe("acme");
  });

  it("returns empty array when type has no entries", async () => {
    await store.upsert(makeSummary({ entityType: "person" }));
    const results = await store.searchByType("location");
    expect(results).toHaveLength(0);
  });
});
