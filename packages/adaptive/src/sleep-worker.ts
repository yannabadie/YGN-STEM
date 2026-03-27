import { HindsightMemory } from "@ygn-stem/memory";

// ---------------------------------------------------------------------------
// SleepStats — returned after a consolidation run
// ---------------------------------------------------------------------------

export interface SleepStats {
  phase: "sleep";
  episodesPruned: number;
  factsDeduped: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// SleepWorker — idle-time memory consolidation
// ---------------------------------------------------------------------------

export class SleepWorker {
  private readonly memory: HindsightMemory;
  private readonly importanceThreshold: number;

  constructor(memory: HindsightMemory, importanceThreshold = 0.3) {
    this.memory = memory;
    this.importanceThreshold = importanceThreshold;
  }

  /**
   * Run a single consolidation pass:
   *  1. Prune low-importance episodes (reflect)
   *  2. Return stats
   */
  async run(): Promise<SleepStats> {
    const startMs = Date.now();

    const reflectStats = await this.memory.reflect({
      importanceThreshold: this.importanceThreshold,
    });

    const durationMs = Date.now() - startMs;

    return {
      phase: "sleep",
      episodesPruned: reflectStats.episodesPruned,
      factsDeduped: 0, // reserved for future deduplication pass
      durationMs,
    };
  }
}
