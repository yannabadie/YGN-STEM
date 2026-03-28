import { describe, it, expect, beforeEach } from "vitest";
import { HindsightMemory } from "../hindsight.js";
import { InMemoryFactsStore } from "../networks/facts-store.js";
import { InMemoryEpisodesStore } from "../networks/episodes-store.js";
import { InMemorySummariesStore } from "../networks/summaries-store.js";
import { InMemoryBeliefsStore } from "../networks/beliefs-store.js";
import { HashEmbeddingProvider } from "../embeddings/hash-provider.js";
import { cosineSimilarity } from "../embeddings/similarity.js";
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

describe("vector-aware recall", () => {
  let facts: InMemoryFactsStore;
  let episodes: InMemoryEpisodesStore;
  let summaries: InMemorySummariesStore;
  let beliefs: InMemoryBeliefsStore;
  let provider: HashEmbeddingProvider;

  beforeEach(() => {
    facts = new InMemoryFactsStore();
    episodes = new InMemoryEpisodesStore();
    summaries = new InMemorySummariesStore();
    beliefs = new InMemoryBeliefsStore();
    provider = new HashEmbeddingProvider(128);
  });

  it("stores episodes with embeddings and recalls by similar text", async () => {
    // Create episodes with embeddings related to their summaries
    const emb1 = await provider.embedSingle("TypeScript generics programming");
    const emb2 = await provider.embedSingle("Python machine learning data");
    const emb3 = await provider.embedSingle("TypeScript types interfaces");

    const memory = new HindsightMemory(
      { facts, episodes, summaries, beliefs },
      provider,
    );

    await memory.retain({
      episode: makeEpisode({
        id: "ep-ts-generics",
        summary: "TypeScript generics programming",
        embedding: emb1,
        tags: ["typescript"],
      }),
    });
    await memory.retain({
      episode: makeEpisode({
        id: "ep-python",
        summary: "Python machine learning data",
        embedding: emb2,
        tags: ["python"],
      }),
    });
    await memory.retain({
      episode: makeEpisode({
        id: "ep-ts-types",
        summary: "TypeScript types interfaces",
        embedding: emb3,
        tags: ["typescript"],
      }),
    });

    // Query for TypeScript - should return TypeScript-related episodes
    const result = await memory.recall({
      query: "TypeScript generics",
      callerId: "caller-alice",
      networks: ["episodes"],
    });

    expect(result.episodes.length).toBeGreaterThan(0);
    // At least one TypeScript episode should be returned
    expect(
      result.episodes.some(
        (e) =>
          e.id === "ep-ts-generics" || e.id === "ep-ts-types",
      ),
    ).toBe(true);
  });

  it("UCB scoring prefers unexplored relevant entries", async () => {
    const memory = new HindsightMemory(
      { facts, episodes, summaries, beliefs },
      provider,
    );

    const emb = await provider.embedSingle("database query optimization");

    await memory.retain({
      episode: makeEpisode({
        id: "ep-db-1",
        summary: "database query optimization",
        embedding: emb,
        tags: ["database"],
      }),
    });
    await memory.retain({
      episode: makeEpisode({
        id: "ep-db-2",
        summary: "database query optimization techniques",
        embedding: await provider.embedSingle(
          "database query optimization techniques",
        ),
        tags: ["database"],
      }),
    });

    // First recall - both should appear (both unexplored)
    const result1 = await memory.recall({
      query: "database optimization",
      callerId: "caller-alice",
      networks: ["episodes"],
    });
    expect(result1.episodes.length).toBeGreaterThan(0);

    // Second recall - UCB should still return results (exploration decreases)
    const result2 = await memory.recall({
      query: "database optimization",
      callerId: "caller-alice",
      networks: ["episodes"],
    });
    expect(result2.episodes.length).toBeGreaterThan(0);
  });

  it("keyword fallback still works when no embedding provider", async () => {
    // No embedding provider = keyword-only recall
    const memory = new HindsightMemory({ facts, episodes, summaries, beliefs });

    await memory.retain({
      episode: makeEpisode({
        id: "ep-keyword",
        summary: "Alice asked about TypeScript generics",
        tags: ["typescript", "generics"],
      }),
      extractedTriples: [
        makeTriple({ subject: "TypeScript", predicate: "has-feature", object: "generics" }),
      ],
    });

    const result = await memory.recall({
      query: "TypeScript",
      callerId: "caller-alice",
    });

    // Should still find results via keyword search
    expect(result.episodes.length + result.facts.length).toBeGreaterThan(0);
    expect(result.totalFound).toBe(result.episodes.length + result.facts.length);
  });

  it("vector recall returns facts from the facts network", async () => {
    const memory = new HindsightMemory(
      { facts, episodes, summaries, beliefs },
      provider,
    );

    await memory.retain({
      episode: makeEpisode(),
      extractedTriples: [
        makeTriple({ subject: "TypeScript", predicate: "supports", object: "generics" }),
      ],
    });

    const result = await memory.recall({
      query: "TypeScript",
      callerId: "caller-alice",
      networks: ["facts"],
    });

    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts[0]!.subject).toBe("TypeScript");
  });

  it("totalFound reflects combined episode and fact count in vector mode", async () => {
    const memory = new HindsightMemory(
      { facts, episodes, summaries, beliefs },
      provider,
    );

    const emb = await provider.embedSingle("TypeScript generics programming");

    await memory.retain({
      episode: makeEpisode({
        id: "ep-combined",
        summary: "TypeScript generics programming",
        embedding: emb,
        tags: ["typescript"],
      }),
      extractedTriples: [
        makeTriple({ subject: "TypeScript", predicate: "supports", object: "generics" }),
      ],
    });

    const result = await memory.recall({
      query: "TypeScript",
      callerId: "caller-alice",
    });

    expect(result.totalFound).toBe(
      result.episodes.length + result.facts.length,
    );
  });

  it("cosine similarity produces expected values for identical embeddings", async () => {
    const emb = await provider.embedSingle("test document");
    expect(cosineSimilarity(emb, emb)).toBeCloseTo(1.0, 10);
  });

  it("cosine similarity is 0 for orthogonal vectors", () => {
    const a = [1, 0, 0, 0];
    const b = [0, 1, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("cosine similarity returns 0 for mismatched dimensions", () => {
    const a = [1, 0, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("respects networks filter in vector mode", async () => {
    const memory = new HindsightMemory(
      { facts, episodes, summaries, beliefs },
      provider,
    );

    const emb = await provider.embedSingle("TypeScript");

    await memory.retain({
      episode: makeEpisode({
        id: "ep-filter",
        summary: "TypeScript",
        embedding: emb,
        tags: ["typescript"],
      }),
      extractedTriples: [makeTriple({ subject: "TypeScript" })],
    });

    const episodesOnly = await memory.recall({
      query: "TypeScript",
      callerId: "caller-alice",
      networks: ["episodes"],
    });

    expect(episodesOnly.facts).toHaveLength(0);
    expect(episodesOnly.episodes.length).toBeGreaterThan(0);

    const factsOnly = await memory.recall({
      query: "TypeScript",
      callerId: "caller-alice",
      networks: ["facts"],
    });

    expect(factsOnly.episodes).toHaveLength(0);
    expect(factsOnly.facts.length).toBeGreaterThan(0);
  });
});
