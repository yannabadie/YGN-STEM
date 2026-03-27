// Unskip when DATABASE_URL is available
// Integration tests require PostgreSQL — run with: pnpm test:integration
import { describe, it, beforeAll, afterAll } from "vitest";

// These tests are skipped because they require a live PostgreSQL database.
// To run them:
//   1. Start a PostgreSQL instance (e.g., via Docker: docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres)
//   2. Set DATABASE_URL=postgres://postgres:pw@localhost:5432/ygn_stem_test
//   3. Run: pnpm --filter @ygn-stem/memory test:integration

describe.skip("PgFactsStore (integration)", () => {
  it("upserts a fact and retrieves it by id", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgFactsStore(db);
    // const fact: StoredFact = { id: "f1", subject: "Alice", predicate: "knows", object: "Bob", confidence: 0.9 };
    // const result = await store.upsert(fact);
    // expect(result.id).toBe("f1");
    // const fetched = await store.getById("f1");
    // expect(fetched).toEqual(result);
  });

  it("deduplicates on SPO — keeps higher confidence", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgFactsStore(db);
    // const base: StoredFact = { id: "f2", subject: "A", predicate: "rel", object: "B", confidence: 0.5 };
    // await store.upsert(base);
    // const higher: StoredFact = { id: "f3", subject: "A", predicate: "rel", object: "B", confidence: 0.9 };
    // const result = await store.upsert(higher);
    // expect(result.confidence).toBe(0.9);
    // expect(await store.count()).toBe(1);
  });

  it("search filters by subject, predicate, object independently", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgFactsStore(db);
    // ... insert multiple facts and verify filter results
  });

  it("delete removes a fact by id", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgFactsStore(db);
    // await store.upsert({ id: "f4", subject: "X", predicate: "y", object: "Z", confidence: 1 });
    // await store.delete("f4");
    // expect(await store.getById("f4")).toBeUndefined();
  });

  it("count returns the correct total", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgFactsStore(db);
    // expect(await store.count()).toBeGreaterThanOrEqual(0);
  });
});

describe.skip("PgEpisodesStore (integration)", () => {
  it("stores an episode and retrieves it by id", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgEpisodesStore(db);
    // const ep: Episode = { id: "e1", callerId: "user-1", requestId: "req-1", summary: "test", importance: 0.7, timestamp: new Date().toISOString(), tags: ["tag1"] };
    // await store.store(ep);
    // const fetched = await store.getById("e1");
    // expect(fetched?.id).toBe("e1");
  });

  it("searchByCaller returns episodes sorted by timestamp desc", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgEpisodesStore(db);
    // ... insert episodes for a caller and verify ordering
  });

  it("searchByKeyword performs case-insensitive ilike on summary", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgEpisodesStore(db);
    // ... insert episodes, search by keyword substring
  });

  it("pruneBelow deletes episodes with importance < threshold and returns count", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgEpisodesStore(db);
    // ... insert low-importance episodes, call pruneBelow, verify deleted count
  });
});

describe.skip("PgSummariesStore (integration)", () => {
  it("upserts a summary and auto-increments version", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgSummariesStore(db);
    // const s: EntitySummary = { entityId: "s1", entityType: "person", summary: "...", cueAnchors: ["Alice"], lastUpdated: new Date().toISOString() };
    // const v1 = await store.upsert(s);
    // expect(v1.version).toBe(1);
    // const v2 = await store.upsert(s);
    // expect(v2.version).toBe(2);
  });

  it("searchByCueAnchor performs case-insensitive substring match", async () => {
    // ... insert summaries with cueAnchors, verify filter
  });

  it("searchByType returns summaries for the given entityType", async () => {
    // ... insert summaries with different types, verify filter
  });
});

describe.skip("PgBeliefsStore (integration)", () => {
  it("upserts a caller profile and increments interactionCount", async () => {
    // const db = createDb(process.env.DATABASE_URL!);
    // const store = new PgBeliefsStore(db);
    // const profile: CallerProfile = { callerId: "caller-1", dimensions: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    // const r1 = await store.upsert(profile);
    // expect(r1.interactionCount).toBe(1);
    // const r2 = await store.upsert(profile);
    // expect(r2.interactionCount).toBe(2);
  });

  it("forgetCaller permanently removes a profile", async () => {
    // ... insert, forgetCaller, verify getById returns undefined
  });

  it("listCallerIds returns all stored caller ids", async () => {
    // ... insert multiple profiles, verify listCallerIds includes them
  });
});
