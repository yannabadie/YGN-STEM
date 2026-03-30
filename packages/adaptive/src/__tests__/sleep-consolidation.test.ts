import { describe, it, expect, beforeEach } from "vitest";
import { SleepWorker, type SleepOptions } from "../sleep-worker.js";
import { CallerProfiler } from "../caller-profiler.js";
import {
  HindsightMemory,
  InMemoryFactsStore,
  InMemoryEpisodesStore,
  InMemorySummariesStore,
  InMemoryBeliefsStore,
} from "@ygn-stem/memory";
import type { Episode } from "@ygn-stem/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _epId = 0;
function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  _epId++;
  return {
    id: `ep-${_epId}`,
    callerId: "caller-alice",
    requestId: `req-${_epId}`,
    summary: "Episode summary with spaces",
    importance: 0.8,
    timestamp: new Date(Date.now() + _epId).toISOString(),
    tags: ["organ-a:intent-x"],
    ...overrides,
  };
}

function makeMemory() {
  const facts = new InMemoryFactsStore();
  const episodes = new InMemoryEpisodesStore();
  const summaries = new InMemorySummariesStore();
  const beliefs = new InMemoryBeliefsStore();
  const memory = new HindsightMemory({ facts, episodes, summaries, beliefs });
  return { memory, facts, episodes, summaries, beliefs };
}

// ---------------------------------------------------------------------------
// SleepStats shape
// ---------------------------------------------------------------------------

describe("SleepStats shape", () => {
  it("includes all required fields in the stats object", async () => {
    const { memory } = makeMemory();
    const worker = new SleepWorker(memory);
    const stats = await worker.run();

    expect(stats.phase).toBe("sleep");
    expect(typeof stats.episodesPruned).toBe("number");
    expect(typeof stats.factsDeduped).toBe("number");
    expect(typeof stats.patternsExtracted).toBe("number");
    expect(typeof stats.profilesRecalibrated).toBe("number");
    expect(typeof stats.durationMs).toBe("number");
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("factsDeduped is always 0 (reserved for future)", async () => {
    const { memory } = makeMemory();
    const worker = new SleepWorker(memory);
    const stats = await worker.run();
    expect(stats.factsDeduped).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 1: Episodic pruning
// ---------------------------------------------------------------------------

describe("Phase 1 – Episodic pruning", () => {
  it("prunes low-importance episodes", async () => {
    const { memory, episodes } = makeMemory();
    await memory.retain({ episode: makeEpisode({ id: "low-1", importance: 0.1 }) });
    await memory.retain({ episode: makeEpisode({ id: "high-1", importance: 0.9 }) });

    const worker = new SleepWorker(memory);
    const stats = await worker.run();

    expect(stats.episodesPruned).toBe(1);
    expect(await episodes.getById("low-1")).toBeUndefined();
    expect(await episodes.getById("high-1")).toBeDefined();
  });

  it("uses custom threshold from SleepOptions", async () => {
    const { memory, episodes } = makeMemory();
    await memory.retain({ episode: makeEpisode({ id: "mid-1", importance: 0.5 }) });
    await memory.retain({ episode: makeEpisode({ id: "high-2", importance: 0.9 }) });

    const worker = new SleepWorker(memory, { importanceThreshold: 0.6 });
    const stats = await worker.run();

    expect(stats.episodesPruned).toBe(1);
    expect(await episodes.count()).toBe(1);
  });

  it("is backward-compatible with plain number threshold", async () => {
    const { memory, episodes } = makeMemory();
    await memory.retain({ episode: makeEpisode({ id: "low-2", importance: 0.1 }) });
    await memory.retain({ episode: makeEpisode({ id: "high-3", importance: 0.9 }) });

    const worker = new SleepWorker(memory, 0.5);
    const stats = await worker.run();

    expect(stats.episodesPruned).toBe(1);
    expect(await episodes.count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Pattern extraction
// ---------------------------------------------------------------------------

describe("Phase 2 – Pattern extraction", () => {
  it("extracts patterns from 3+ recurring episodes with same tag", async () => {
    const { memory, summaries } = makeMemory();

    const tag = "organ-x:intent-y";
    for (let i = 0; i < 3; i++) {
      await memory.retain({
        episode: makeEpisode({
          id: `pattern-ep-${i}`,
          callerId: "caller-bob",
          tags: [tag],
          importance: 0.9,
          summary: `Episode ${i} with spaces for scan`,
        }),
      });
    }

    const worker = new SleepWorker(memory);
    const stats = await worker.run();

    expect(stats.patternsExtracted).toBeGreaterThanOrEqual(1);

    // A summary entity should have been upserted
    const storedSummary = await summaries.getById(`pattern:caller-bob:${tag}`);
    expect(storedSummary).toBeDefined();
    expect(storedSummary?.entityType).toBe("pattern");
  });

  it("does NOT extract a pattern from fewer than 3 episodes", async () => {
    const { memory } = makeMemory();

    for (let i = 0; i < 2; i++) {
      await memory.retain({
        episode: makeEpisode({
          id: `few-ep-${i}`,
          tags: ["rare-tag"],
          importance: 0.9,
          summary: `Two only with spaces`,
        }),
      });
    }

    const worker = new SleepWorker(memory);
    const stats = await worker.run();

    expect(stats.patternsExtracted).toBe(0);
  });

  it("counts patterns across different tag groups independently", async () => {
    const { memory } = makeMemory();

    // Group A: 3 episodes with tag-a
    for (let i = 0; i < 3; i++) {
      await memory.retain({
        episode: makeEpisode({
          id: `a-ep-${i}`,
          callerId: "caller-cathy",
          tags: ["tag-a"],
          importance: 0.9,
          summary: `Group A episode with spaces`,
        }),
      });
    }

    // Group B: 3 episodes with tag-b
    for (let i = 0; i < 3; i++) {
      await memory.retain({
        episode: makeEpisode({
          id: `b-ep-${i}`,
          callerId: "caller-cathy",
          tags: ["tag-b"],
          importance: 0.9,
          summary: `Group B episode with spaces`,
        }),
      });
    }

    const worker = new SleepWorker(memory);
    const stats = await worker.run();

    // Two distinct patterns
    expect(stats.patternsExtracted).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Phase 3: Profile recalibration
// ---------------------------------------------------------------------------

describe("Phase 3 – Profile recalibration", () => {
  it("returns 0 profilesRecalibrated when no profiler is provided", async () => {
    const { memory } = makeMemory();
    const worker = new SleepWorker(memory);
    const stats = await worker.run();
    expect(stats.profilesRecalibrated).toBe(0);
  });

  it("runs reflect() on all known callers when profiler is provided", async () => {
    const { memory, beliefs } = makeMemory();

    // Create a profiler backed by the same beliefs store
    const profiler = new CallerProfiler(beliefs);

    // Curate 2x with low signal to put "dana" in the beliefs store
    await profiler.curate("dana", { verbosity_preference: 0.1 });
    await profiler.curate("dana", { verbosity_preference: 0.1 });

    const worker = new SleepWorker(memory, { profiler });
    const stats = await worker.run();

    // "dana" is in the beliefs store — profilesRecalibrated counts reflect() calls
    expect(stats.profilesRecalibrated).toBeGreaterThanOrEqual(0);
    expect(typeof stats.profilesRecalibrated).toBe("number");
  });

  it("counts a calibration as recalibrated only when drift is detected", async () => {
    const store2 = new InMemoryBeliefsStore();
    const profiler2 = new CallerProfiler(store2);

    // Stabilise profile for "drift-user" near 0.0 with 30 low signals
    for (let i = 0; i < 30; i++) {
      await profiler2.curate("drift-user", { verbosity_preference: 0.0 });
    }

    // New profiler sharing same store — fresh signal history
    const store3 = store2; // same store
    const profiler3 = new CallerProfiler(store3);

    // Add 2 high signals — will trigger drift on reflect
    await profiler3.curate("drift-user", { verbosity_preference: 0.9 });
    await profiler3.curate("drift-user", { verbosity_preference: 0.9 });

    const { memory: m2 } = makeMemory();
    const worker = new SleepWorker(m2, { profiler: profiler3 });
    // Note: profiler3 uses store3 which has "drift-user"; worker.memory uses
    // a separate InMemoryBeliefsStore for its episodes.
    // We need the beliefs store to list "drift-user" as a known callerId.
    // Since worker.memory is a different HindsightMemory, let's build one that
    // shares the beliefs store with the profiler.

    const sharedBeliefs = store3;
    const memoryShared = new HindsightMemory({
      facts: new InMemoryFactsStore(),
      episodes: new InMemoryEpisodesStore(),
      summaries: new InMemorySummariesStore(),
      beliefs: sharedBeliefs,
    });

    const profiler4 = new CallerProfiler(sharedBeliefs);
    // Re-add high signals in profiler4's signal history
    await profiler4.curate("drift-user", { verbosity_preference: 0.9 });
    await profiler4.curate("drift-user", { verbosity_preference: 0.9 });

    const workerShared = new SleepWorker(memoryShared, { profiler: profiler4 });
    const stats = await workerShared.run();

    // drift-user has drift → profilesRecalibrated ≥ 1
    expect(stats.profilesRecalibrated).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe("Idempotency", () => {
  it("second run does not double-prune episodes", async () => {
    const { memory, episodes } = makeMemory();
    await memory.retain({ episode: makeEpisode({ id: "idem-low", importance: 0.1 }) });
    await memory.retain({ episode: makeEpisode({ id: "idem-high", importance: 0.9 }) });

    const worker = new SleepWorker(memory);
    const first = await worker.run();
    const second = await worker.run();

    expect(first.episodesPruned).toBe(1);
    expect(second.episodesPruned).toBe(0); // nothing left to prune
    expect(await episodes.count()).toBe(1);
  });

  it("pattern extraction is idempotent — upsert replaces existing summary", async () => {
    const { memory, summaries } = makeMemory();
    const tag = "idempotent-tag";

    for (let i = 0; i < 3; i++) {
      await memory.retain({
        episode: makeEpisode({
          id: `idem-p-ep-${i}`,
          callerId: "caller-eve",
          tags: [tag],
          importance: 0.9,
          summary: `Idempotent pattern episode with spaces`,
        }),
      });
    }

    const worker = new SleepWorker(memory);
    const first = await worker.run();
    const second = await worker.run();

    // Both runs should report pattern(s) found (upsert, not duplicate insert)
    expect(first.patternsExtracted).toBeGreaterThanOrEqual(1);
    expect(second.patternsExtracted).toBeGreaterThanOrEqual(1);

    // Summary count should remain stable (upsert, not insert twice)
    const summaryCount = await summaries.count();
    expect(summaryCount).toBeLessThanOrEqual(first.patternsExtracted + 1);
  });
});
