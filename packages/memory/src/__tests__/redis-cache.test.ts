import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryCache } from "../redis/redis-cache.js";

// All tests use in-memory fallback (no Redis URL provided)

describe("MemoryCache (in-memory fallback)", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(); // no URL → in-memory
  });

  afterEach(async () => {
    await cache.close();
    vi.useRealTimers();
  });

  // ---- basic get/set -------------------------------------------------------

  it("caches and retrieves a value", async () => {
    await cache.set("key1", { hello: "world" }, 60);
    const result = await cache.get<{ hello: string }>("key1");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns null for a missing key", async () => {
    const result = await cache.get("nonexistent");
    expect(result).toBeNull();
  });

  it("caches primitive values", async () => {
    await cache.set("num", 42, 60);
    await cache.set("str", "hello", 60);
    await cache.set("bool", true, 60);

    expect(await cache.get<number>("num")).toBe(42);
    expect(await cache.get<string>("str")).toBe("hello");
    expect(await cache.get<boolean>("bool")).toBe(true);
  });

  // ---- TTL -----------------------------------------------------------------

  it("respects TTL — returns null after expiry", async () => {
    vi.useFakeTimers();

    await cache.set("ttl-key", "alive", 10); // 10s TTL

    // Before expiry
    expect(await cache.get("ttl-key")).toBe("alive");

    // Advance time past TTL
    vi.advanceTimersByTime(11_000);

    expect(await cache.get("ttl-key")).toBeNull();
  });

  it("still returns value just before TTL expires", async () => {
    vi.useFakeTimers();

    await cache.set("ttl-key2", "alive", 10);

    // Advance to 9 seconds (still within TTL)
    vi.advanceTimersByTime(9_000);

    expect(await cache.get("ttl-key2")).toBe("alive");
  });

  // ---- invalidate ----------------------------------------------------------

  it("invalidates a single key", async () => {
    await cache.set("del-key", "value", 60);
    expect(await cache.get("del-key")).toBe("value");

    await cache.invalidate("del-key");
    expect(await cache.get("del-key")).toBeNull();
  });

  it("invalidate of a nonexistent key is a no-op", async () => {
    await expect(cache.invalidate("ghost")).resolves.toBeUndefined();
  });

  // ---- invalidateByPrefix --------------------------------------------------

  it("invalidates all keys matching a prefix", async () => {
    await cache.set("recall:alice:aabb", { episodes: [] }, 60);
    await cache.set("recall:alice:ccdd", { episodes: [] }, 60);
    await cache.set("caller:bob:profile", { name: "bob" }, 60);

    await cache.invalidateByPrefix("recall:alice:");

    expect(await cache.get("recall:alice:aabb")).toBeNull();
    expect(await cache.get("recall:alice:ccdd")).toBeNull();
    // Unrelated key should survive
    expect(await cache.get("caller:bob:profile")).toEqual({ name: "bob" });
  });

  it("invalidateByPrefix with no matches is a no-op", async () => {
    await cache.set("recall:bob:aabb", "val", 60);
    await cache.invalidateByPrefix("recall:alice:");
    // bob's key must survive
    expect(await cache.get("recall:bob:aabb")).toBe("val");
  });

  // ---- static key generators ----------------------------------------------

  describe("static key generators", () => {
    it("recallKey produces a stable key for same inputs", () => {
      const k1 = MemoryCache.recallKey("alice", "what is TypeScript?");
      const k2 = MemoryCache.recallKey("alice", "what is TypeScript?");
      expect(k1).toBe(k2);
    });

    it("recallKey starts with 'recall:{callerId}:'", () => {
      const k = MemoryCache.recallKey("alice", "query");
      expect(k).toMatch(/^recall:alice:/);
    });

    it("recallKey hash portion is 12 chars", () => {
      const k = MemoryCache.recallKey("alice", "query");
      const hash = k.split(":")[2];
      expect(hash).toHaveLength(12);
    });

    it("recallKey differs for different queries", () => {
      const k1 = MemoryCache.recallKey("alice", "query one");
      const k2 = MemoryCache.recallKey("alice", "query two");
      expect(k1).not.toBe(k2);
    });

    it("recallKey differs for different callerIds", () => {
      const k1 = MemoryCache.recallKey("alice", "same query");
      const k2 = MemoryCache.recallKey("bob", "same query");
      expect(k1).not.toBe(k2);
    });

    it("profileKey produces 'caller:{callerId}:profile'", () => {
      expect(MemoryCache.profileKey("alice")).toBe("caller:alice:profile");
      expect(MemoryCache.profileKey("bob")).toBe("caller:bob:profile");
    });
  });
});

// ---------------------------------------------------------------------------
// HindsightMemory + cache integration
// ---------------------------------------------------------------------------

describe("HindsightMemory with MemoryCache", () => {
  it("uses cache to serve repeated recall queries", async () => {
    const { HindsightMemory } = await import("../hindsight.js");
    const { InMemoryFactsStore } = await import("../networks/facts-store.js");
    const { InMemoryEpisodesStore } = await import("../networks/episodes-store.js");
    const { InMemorySummariesStore } = await import("../networks/summaries-store.js");
    const { InMemoryBeliefsStore } = await import("../networks/beliefs-store.js");

    const cache = new MemoryCache();
    const episodesStore = new InMemoryEpisodesStore();

    const memory = new HindsightMemory(
      {
        facts: new InMemoryFactsStore(),
        episodes: episodesStore,
        summaries: new InMemorySummariesStore(),
        beliefs: new InMemoryBeliefsStore(),
      },
      undefined, // no embedding provider
      cache,
    );

    await memory.retain({
      episode: {
        id: "ep-1",
        callerId: "alice",
        requestId: "req-1",
        summary: "Alice asked about TypeScript",
        importance: 0.8,
        timestamp: "2024-01-01T12:00:00.000Z",
        tags: ["typescript"],
      },
    });

    const query = { query: "TypeScript", callerId: "alice" };

    // First call populates cache
    const r1 = await memory.recall(query);
    expect(r1.episodes.length).toBeGreaterThan(0);

    // Add a second episode — if cache is working, second recall still returns r1 data
    await memory.retain({
      episode: {
        id: "ep-2",
        callerId: "alice",
        requestId: "req-2",
        summary: "Another TypeScript question",
        importance: 0.9,
        timestamp: "2024-01-02T12:00:00.000Z",
        tags: ["typescript"],
      },
    });

    // Second call should hit cache (returns same result as first call)
    const r2 = await memory.recall(query);
    expect(r2.totalFound).toBe(r1.totalFound);

    await cache.close();
  });
});
