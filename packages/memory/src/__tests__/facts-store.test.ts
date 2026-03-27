import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryFactsStore,
  type StoredFact,
} from "../networks/facts-store.js";

function makeFact(overrides: Partial<StoredFact> = {}): StoredFact {
  return {
    id: "fact-1",
    subject: "Alice",
    predicate: "knows",
    object: "Bob",
    confidence: 0.9,
    ...overrides,
  };
}

describe("InMemoryFactsStore", () => {
  let store: InMemoryFactsStore;

  beforeEach(() => {
    store = new InMemoryFactsStore();
  });

  // ---- basic CRUD --------------------------------------------------------

  it("stores and retrieves a fact by id", async () => {
    const fact = makeFact();
    await store.upsert(fact);
    const found = await store.getById("fact-1");
    expect(found).toEqual(fact);
  });

  it("returns undefined for unknown id", async () => {
    const found = await store.getById("nope");
    expect(found).toBeUndefined();
  });

  it("counts stored facts", async () => {
    expect(await store.count()).toBe(0);
    await store.upsert(makeFact({ id: "a" }));
    await store.upsert(makeFact({ id: "b", subject: "Bob", object: "Carol" }));
    expect(await store.count()).toBe(2);
  });

  it("deletes a fact by id", async () => {
    await store.upsert(makeFact());
    await store.delete("fact-1");
    expect(await store.getById("fact-1")).toBeUndefined();
    expect(await store.count()).toBe(0);
  });

  it("silently no-ops when deleting a non-existent id", async () => {
    await expect(store.delete("ghost")).resolves.toBeUndefined();
  });

  // ---- search ------------------------------------------------------------

  it("searches by subject", async () => {
    await store.upsert(makeFact({ id: "a", subject: "Alice" }));
    await store.upsert(makeFact({ id: "b", subject: "Bob", object: "Carol" }));
    const results = await store.search({ subject: "Alice" });
    expect(results).toHaveLength(1);
    expect(results[0]?.subject).toBe("Alice");
  });

  it("searches by predicate", async () => {
    await store.upsert(makeFact({ id: "a", predicate: "knows" }));
    await store.upsert(
      makeFact({ id: "b", predicate: "hates", subject: "Bob", object: "Carol" }),
    );
    const results = await store.search({ predicate: "knows" });
    expect(results).toHaveLength(1);
    expect(results[0]?.predicate).toBe("knows");
  });

  it("searches by object", async () => {
    await store.upsert(makeFact({ id: "a", object: "Bob" }));
    await store.upsert(
      makeFact({ id: "b", object: "Carol", subject: "Bob" }),
    );
    const results = await store.search({ object: "Carol" });
    expect(results).toHaveLength(1);
    expect(results[0]?.object).toBe("Carol");
  });

  it("returns all facts when search options are empty", async () => {
    await store.upsert(makeFact({ id: "a" }));
    await store.upsert(makeFact({ id: "b", subject: "Bob", object: "Carol" }));
    const results = await store.search({});
    expect(results).toHaveLength(2);
  });

  // ---- deduplication -----------------------------------------------------

  it("deduplicates on S+P+O and keeps higher confidence", async () => {
    const low = makeFact({ id: "fact-low", confidence: 0.3 });
    const high = makeFact({ id: "fact-high", confidence: 0.9 });

    await store.upsert(low);
    await store.upsert(high); // same S+P+O, higher confidence

    // Should still be only 1 fact
    expect(await store.count()).toBe(1);
    const found = await store.getById("fact-low");
    expect(found?.confidence).toBe(0.9);
  });

  it("does not replace when incoming confidence is lower", async () => {
    const high = makeFact({ id: "fact-high", confidence: 0.9 });
    const low = makeFact({ id: "fact-low", confidence: 0.3 });

    await store.upsert(high);
    await store.upsert(low); // lower confidence — should be ignored

    expect(await store.count()).toBe(1);
    const found = await store.getById("fact-high");
    expect(found?.confidence).toBe(0.9);
  });

  it("treats facts with different S+P+O as separate entries", async () => {
    await store.upsert(makeFact({ id: "a", subject: "Alice" }));
    await store.upsert(
      makeFact({ id: "b", subject: "Bob", object: "Carol" }),
    );
    expect(await store.count()).toBe(2);
  });
});
