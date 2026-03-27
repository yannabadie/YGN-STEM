import { describe, it, expect, beforeEach } from "vitest";
import { HindsightMemory } from "../hindsight.js";
import { InMemoryFactsStore } from "../networks/facts-store.js";
import { InMemoryEpisodesStore } from "../networks/episodes-store.js";
import { InMemorySummariesStore } from "../networks/summaries-store.js";
import { InMemoryBeliefsStore } from "../networks/beliefs-store.js";
import type { Episode, FactTriple } from "@ygn-stem/shared";

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: "ep-1",
    callerId: "caller-alice",
    requestId: "req-1",
    summary: "Alice asked about TypeScript generics",
    importance: 0.8,
    timestamp: "2024-01-01T12:00:00.000Z",
    tags: ["typescript", "generics"],
    ...overrides,
  };
}

function makeTriple(overrides: Partial<FactTriple> = {}): FactTriple {
  return {
    subject: "TypeScript",
    predicate: "is-a",
    object: "programming language",
    confidence: 0.95,
    ...overrides,
  };
}

describe("HindsightMemory", () => {
  let facts: InMemoryFactsStore;
  let episodes: InMemoryEpisodesStore;
  let summaries: InMemorySummariesStore;
  let beliefs: InMemoryBeliefsStore;
  let memory: HindsightMemory;

  beforeEach(() => {
    facts = new InMemoryFactsStore();
    episodes = new InMemoryEpisodesStore();
    summaries = new InMemorySummariesStore();
    beliefs = new InMemoryBeliefsStore();
    memory = new HindsightMemory({ facts, episodes, summaries, beliefs });
  });

  // ---- RETAIN ------------------------------------------------------------

  it("RETAIN stores the episode in the episodes network", async () => {
    const ep = makeEpisode();
    await memory.retain({ episode: ep });
    const found = await episodes.getById("ep-1");
    expect(found).toEqual(ep);
  });

  it("RETAIN stores extracted triples in the facts network", async () => {
    const ep = makeEpisode();
    const triple = makeTriple();
    await memory.retain({ episode: ep, extractedTriples: [triple] });
    expect(await facts.count()).toBe(1);
  });

  it("RETAIN with no extractedTriples leaves facts network empty", async () => {
    await memory.retain({ episode: makeEpisode() });
    expect(await facts.count()).toBe(0);
  });

  it("RETAIN with empty extractedTriples array leaves facts network empty", async () => {
    await memory.retain({ episode: makeEpisode(), extractedTriples: [] });
    expect(await facts.count()).toBe(0);
  });

  it("RETAIN stores multiple triples", async () => {
    const triples: FactTriple[] = [
      makeTriple(),
      makeTriple({ subject: "Alice", predicate: "uses", object: "TypeScript" }),
    ];
    await memory.retain({ episode: makeEpisode(), extractedTriples: triples });
    expect(await facts.count()).toBe(2);
  });

  // ---- RECALL ------------------------------------------------------------

  it("RECALL returns episodes matching the caller", async () => {
    await memory.retain({ episode: makeEpisode({ id: "ep-1" }) });
    await memory.retain({
      episode: makeEpisode({ id: "ep-2", callerId: "caller-bob" }),
    });

    const result = await memory.recall({
      query: "generics",
      callerId: "caller-alice",
    });

    expect(result.episodes.some((e) => e.callerId === "caller-alice")).toBe(
      true,
    );
  });

  it("RECALL returns facts matching the query string", async () => {
    const triple = makeTriple({
      subject: "TypeScript",
      predicate: "has-feature",
      object: "generics",
    });
    await memory.retain({
      episode: makeEpisode(),
      extractedTriples: [triple],
    });

    const result = await memory.recall({
      query: "TypeScript",
      callerId: "caller-alice",
      networks: ["facts"],
    });

    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts[0]?.subject).toBe("TypeScript");
  });

  it("RECALL totalFound reflects the combined count", async () => {
    await memory.retain({
      episode: makeEpisode(),
      extractedTriples: [makeTriple({ subject: "TypeScript" })],
    });

    const result = await memory.recall({
      query: "TypeScript",
      callerId: "caller-alice",
    });

    expect(result.totalFound).toBe(
      result.episodes.length + result.facts.length,
    );
  });

  it("RECALL respects the networks filter — episodes only", async () => {
    await memory.retain({
      episode: makeEpisode(),
      extractedTriples: [makeTriple()],
    });

    const result = await memory.recall({
      query: "typescript",
      callerId: "caller-alice",
      networks: ["episodes"],
    });

    expect(result.facts).toHaveLength(0);
    expect(result.episodes.length).toBeGreaterThan(0);
  });

  it("RECALL respects the networks filter — facts only", async () => {
    await memory.retain({
      episode: makeEpisode(),
      extractedTriples: [makeTriple({ subject: "TypeScript" })],
    });

    const result = await memory.recall({
      query: "TypeScript",
      callerId: "caller-alice",
      networks: ["facts"],
    });

    expect(result.episodes).toHaveLength(0);
    expect(result.facts.length).toBeGreaterThan(0);
  });

  it("RECALL returns empty results when networks list is empty", async () => {
    await memory.retain({ episode: makeEpisode() });

    const result = await memory.recall({
      query: "generics",
      callerId: "caller-alice",
      networks: [],
    });

    expect(result.episodes).toHaveLength(0);
    expect(result.facts).toHaveLength(0);
    expect(result.totalFound).toBe(0);
  });

  // ---- REFLECT -----------------------------------------------------------

  it("REFLECT prunes low-importance episodes and returns stats", async () => {
    await memory.retain({ episode: makeEpisode({ id: "low", importance: 0.1 }) });
    await memory.retain({ episode: makeEpisode({ id: "high", importance: 0.9 }) });

    const stats = await memory.reflect({ importanceThreshold: 0.4 });

    expect(stats.episodesPruned).toBe(1);
    expect(stats.importanceThreshold).toBe(0.4);
    expect(await episodes.count()).toBe(1);
    expect(await episodes.getById("low")).toBeUndefined();
    expect(await episodes.getById("high")).toBeDefined();
  });

  it("REFLECT uses default threshold of 0.3 when none is provided", async () => {
    await memory.retain({
      episode: makeEpisode({ id: "below", importance: 0.2 }),
    });
    await memory.retain({
      episode: makeEpisode({ id: "above", importance: 0.6 }),
    });

    const stats = await memory.reflect();
    expect(stats.importanceThreshold).toBe(0.3);
    expect(stats.episodesPruned).toBe(1);
  });

  it("REFLECT returns 0 pruned when all episodes meet the threshold", async () => {
    await memory.retain({
      episode: makeEpisode({ id: "a", importance: 0.9 }),
    });

    const stats = await memory.reflect({ importanceThreshold: 0.1 });
    expect(stats.episodesPruned).toBe(0);
    expect(await episodes.count()).toBe(1);
  });
});
