import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryEpisodesStore,
  type ImportanceFactors,
} from "../networks/episodes-store.js";
import type { Episode } from "@ygn-stem/shared";

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: "ep-1",
    callerId: "caller-alice",
    requestId: "req-1",
    summary: "Alice asked about the weather in Tokyo",
    importance: 0.7,
    timestamp: "2024-01-01T12:00:00.000Z",
    tags: ["weather", "tokyo"],
    ...overrides,
  };
}

describe("InMemoryEpisodesStore", () => {
  let store: InMemoryEpisodesStore;

  beforeEach(() => {
    store = new InMemoryEpisodesStore();
  });

  // ---- basic CRUD --------------------------------------------------------

  it("stores and retrieves an episode by id", async () => {
    const ep = makeEpisode();
    await store.store(ep);
    const found = await store.getById("ep-1");
    expect(found).toEqual(ep);
  });

  it("returns undefined for unknown id", async () => {
    const found = await store.getById("ghost");
    expect(found).toBeUndefined();
  });

  it("counts stored episodes", async () => {
    expect(await store.count()).toBe(0);
    await store.store(makeEpisode({ id: "a" }));
    await store.store(makeEpisode({ id: "b", callerId: "caller-bob" }));
    expect(await store.count()).toBe(2);
  });

  // ---- searchByCaller ----------------------------------------------------

  it("returns episodes for a specific caller sorted by timestamp desc", async () => {
    await store.store(
      makeEpisode({ id: "old", timestamp: "2024-01-01T00:00:00.000Z" }),
    );
    await store.store(
      makeEpisode({ id: "new", timestamp: "2024-06-01T00:00:00.000Z" }),
    );
    await store.store(
      makeEpisode({ id: "other", callerId: "caller-bob", timestamp: "2024-03-01T00:00:00.000Z" }),
    );

    const results = await store.searchByCaller("caller-alice");
    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe("new"); // most recent first
    expect(results[1]?.id).toBe("old");
  });

  it("respects the limit parameter in searchByCaller", async () => {
    for (let i = 0; i < 5; i++) {
      await store.store(
        makeEpisode({
          id: `ep-${i}`,
          timestamp: `2024-01-0${i + 1}T00:00:00.000Z`,
        }),
      );
    }
    const results = await store.searchByCaller("caller-alice", 3);
    expect(results).toHaveLength(3);
  });

  // ---- searchByKeyword ---------------------------------------------------

  it("finds episodes matching keyword in summary", async () => {
    await store.store(makeEpisode({ id: "a", summary: "Discussed quantum computing" }));
    await store.store(makeEpisode({ id: "b", summary: "Talked about recipes", tags: [] }));

    const results = await store.searchByKeyword("quantum");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("a");
  });

  it("finds episodes matching keyword in tags", async () => {
    await store.store(makeEpisode({ id: "a", tags: ["python", "ml"] }));
    await store.store(makeEpisode({ id: "b", tags: ["javascript"] }));

    const results = await store.searchByKeyword("python");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("a");
  });

  it("sorts keyword results by importance desc", async () => {
    await store.store(
      makeEpisode({ id: "low", summary: "quantum low", importance: 0.2 }),
    );
    await store.store(
      makeEpisode({ id: "high", summary: "quantum high", importance: 0.9 }),
    );

    const results = await store.searchByKeyword("quantum");
    expect(results[0]?.id).toBe("high");
    expect(results[1]?.id).toBe("low");
  });

  it("respects the limit parameter in searchByKeyword", async () => {
    for (let i = 0; i < 5; i++) {
      await store.store(
        makeEpisode({ id: `ep-${i}`, summary: `topic discussion ${i}` }),
      );
    }
    const results = await store.searchByKeyword("topic", 2);
    expect(results).toHaveLength(2);
  });

  // ---- pruneBelow --------------------------------------------------------

  it("prunes episodes below the importance threshold", async () => {
    await store.store(makeEpisode({ id: "a", importance: 0.1 }));
    await store.store(makeEpisode({ id: "b", importance: 0.5 }));
    await store.store(makeEpisode({ id: "c", importance: 0.8 }));

    const pruned = await store.pruneBelow(0.4);
    expect(pruned).toBe(1); // only "a" is below 0.4
    expect(await store.count()).toBe(2);
    expect(await store.getById("a")).toBeUndefined();
    expect(await store.getById("b")).toBeDefined();
    expect(await store.getById("c")).toBeDefined();
  });

  it("returns 0 when nothing is below threshold", async () => {
    await store.store(makeEpisode({ id: "a", importance: 0.9 }));
    const pruned = await store.pruneBelow(0.1);
    expect(pruned).toBe(0);
    expect(await store.count()).toBe(1);
  });

  it("does not prune episodes at exactly the threshold", async () => {
    await store.store(makeEpisode({ id: "a", importance: 0.4 }));
    const pruned = await store.pruneBelow(0.4);
    expect(pruned).toBe(0); // strict less-than
  });

  // ---- computeImportance -------------------------------------------------

  it("computes importance with the weighted formula", () => {
    const factors: ImportanceFactors = {
      novelty: 1.0,
      outcomeSignificance: 1.0,
      callerRarity: 1.0,
      toolCount: 5,
    };
    const score = InMemoryEpisodesStore.computeImportance(factors);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it("caps toolCount contribution at min(1, toolCount/5)", () => {
    const factors: ImportanceFactors = {
      novelty: 0,
      outcomeSignificance: 0,
      callerRarity: 0,
      toolCount: 100, // well above 5
    };
    const score = InMemoryEpisodesStore.computeImportance(factors);
    // 0.2 * min(1, 100/5) = 0.2 * 1 = 0.2
    expect(score).toBeCloseTo(0.2, 5);
  });

  it("gives 0 score when all factors are 0 and toolCount is 0", () => {
    const factors: ImportanceFactors = {
      novelty: 0,
      outcomeSignificance: 0,
      callerRarity: 0,
      toolCount: 0,
    };
    expect(InMemoryEpisodesStore.computeImportance(factors)).toBeCloseTo(0, 5);
  });

  it("weighs partial toolCount correctly", () => {
    // toolCount=2 → min(1, 2/5) = 0.4
    const factors: ImportanceFactors = {
      novelty: 0,
      outcomeSignificance: 0,
      callerRarity: 0,
      toolCount: 2,
    };
    const score = InMemoryEpisodesStore.computeImportance(factors);
    expect(score).toBeCloseTo(0.2 * 0.4, 5);
  });
});
