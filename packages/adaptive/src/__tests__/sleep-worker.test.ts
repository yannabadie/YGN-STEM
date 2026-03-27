import { describe, it, expect, beforeEach } from "vitest";
import { SleepWorker } from "../sleep-worker.js";
import {
  HindsightMemory,
  InMemoryFactsStore,
  InMemoryEpisodesStore,
  InMemorySummariesStore,
  InMemoryBeliefsStore,
} from "@ygn-stem/memory";
import type { Episode } from "@ygn-stem/shared";

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: "ep-1",
    callerId: "caller-alice",
    requestId: "req-1",
    summary: "Test episode",
    importance: 0.2, // below the default threshold of 0.3
    timestamp: "2024-01-01T12:00:00.000Z",
    ...overrides,
  };
}

function makeMemory(): HindsightMemory {
  return new HindsightMemory({
    facts: new InMemoryFactsStore(),
    episodes: new InMemoryEpisodesStore(),
    summaries: new InMemorySummariesStore(),
    beliefs: new InMemoryBeliefsStore(),
  });
}

describe("SleepWorker", () => {
  let memory: HindsightMemory;
  let episodes: InMemoryEpisodesStore;
  let worker: SleepWorker;

  beforeEach(() => {
    episodes = new InMemoryEpisodesStore();
    memory = new HindsightMemory({
      facts: new InMemoryFactsStore(),
      episodes,
      summaries: new InMemorySummariesStore(),
      beliefs: new InMemoryBeliefsStore(),
    });
    worker = new SleepWorker(memory);
  });

  // ---- run ---------------------------------------------------------------

  it("runs consolidation and returns SleepStats", async () => {
    await memory.retain({ episode: makeEpisode({ id: "low", importance: 0.1 }) });
    await memory.retain({ episode: makeEpisode({ id: "mid", importance: 0.5 }) });

    const stats = await worker.run();

    expect(stats.phase).toBe("sleep");
    expect(typeof stats.episodesPruned).toBe("number");
    expect(typeof stats.factsDeduped).toBe("number");
    expect(typeof stats.durationMs).toBe("number");
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("prunes episodes below the importance threshold", async () => {
    await memory.retain({ episode: makeEpisode({ id: "low", importance: 0.1 }) });
    await memory.retain({ episode: makeEpisode({ id: "high", importance: 0.9 }) });

    const stats = await worker.run();

    expect(stats.episodesPruned).toBe(1);
    expect(await episodes.count()).toBe(1);
    expect(await episodes.getById("low")).toBeUndefined();
    expect(await episodes.getById("high")).toBeDefined();
  });

  it("respects a custom importance threshold", async () => {
    const customWorker = new SleepWorker(memory, 0.6);
    await memory.retain({ episode: makeEpisode({ id: "low", importance: 0.1 }) });
    await memory.retain({ episode: makeEpisode({ id: "mid", importance: 0.5 }) });
    await memory.retain({ episode: makeEpisode({ id: "high", importance: 0.9 }) });

    const stats = await customWorker.run();

    expect(stats.episodesPruned).toBe(2); // both low and mid pruned
    expect(await episodes.count()).toBe(1);
  });

  it("uses default threshold of 0.3 when none is provided", async () => {
    await memory.retain({ episode: makeEpisode({ id: "below", importance: 0.2 }) });
    await memory.retain({ episode: makeEpisode({ id: "above", importance: 0.5 }) });

    const stats = await worker.run();

    expect(stats.episodesPruned).toBe(1);
  });

  // ---- idempotency -------------------------------------------------------

  it("is idempotent — second run does not double-prune", async () => {
    await memory.retain({ episode: makeEpisode({ id: "low", importance: 0.1 }) });
    await memory.retain({ episode: makeEpisode({ id: "high", importance: 0.9 }) });

    const first = await worker.run();
    const second = await worker.run();

    expect(first.episodesPruned).toBe(1);
    // Second run finds nothing new to prune
    expect(second.episodesPruned).toBe(0);
    expect(await episodes.count()).toBe(1);
  });

  it("returns zero episodesPruned when store is empty", async () => {
    const stats = await worker.run();
    expect(stats.episodesPruned).toBe(0);
    expect(stats.phase).toBe("sleep");
  });

  // ---- SleepStats shape --------------------------------------------------

  it("factsDeduped is always a non-negative number", async () => {
    const stats = await worker.run();
    expect(stats.factsDeduped).toBeGreaterThanOrEqual(0);
  });
});
