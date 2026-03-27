import type { Episode } from "@ygn-stem/shared";

// ---------------------------------------------------------------------------
// IEpisodesStore contract
// ---------------------------------------------------------------------------
export interface IEpisodesStore {
  /** Persist an episode. */
  store(episode: Episode): Promise<Episode>;

  /** Retrieve an episode by its id.  Returns undefined when not found. */
  getById(id: string): Promise<Episode | undefined>;

  /**
   * Return episodes for a specific caller, sorted by timestamp descending.
   * @param limit  Max results (default: 50).
   */
  searchByCaller(callerId: string, limit?: number): Promise<Episode[]>;

  /**
   * Full-text search across episode summaries and tags.
   * Results are sorted by importance descending.
   * @param limit  Max results (default: 20).
   */
  searchByKeyword(keyword: string, limit?: number): Promise<Episode[]>;

  /**
   * Delete all episodes whose importance is strictly below the threshold.
   * @returns  Number of episodes deleted.
   */
  pruneBelow(importanceThreshold: number): Promise<number>;

  /** Total number of episodes currently stored. */
  count(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Static helper: importance formula
// ---------------------------------------------------------------------------
export interface ImportanceFactors {
  novelty: number;
  outcomeSignificance: number;
  callerRarity: number;
  toolCount: number;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------
export class InMemoryEpisodesStore implements IEpisodesStore {
  private readonly byId = new Map<string, Episode>();

  /**
   * Compute an importance score in [0, 1].
   *
   * score = 0.3·novelty + 0.3·outcomeSignificance
   *       + 0.2·callerRarity + 0.2·min(1, toolCount / 5)
   */
  static computeImportance(factors: ImportanceFactors): number {
    const { novelty, outcomeSignificance, callerRarity, toolCount } = factors;
    return (
      0.3 * novelty +
      0.3 * outcomeSignificance +
      0.2 * callerRarity +
      0.2 * Math.min(1, toolCount / 5)
    );
  }

  async store(episode: Episode): Promise<Episode> {
    this.byId.set(episode.id, episode);
    return episode;
  }

  async getById(id: string): Promise<Episode | undefined> {
    return this.byId.get(id);
  }

  async searchByCaller(callerId: string, limit = 50): Promise<Episode[]> {
    const matches = [...this.byId.values()].filter(
      (e) => e.callerId === callerId,
    );
    // Sort by timestamp descending
    matches.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return matches.slice(0, limit);
  }

  async searchByKeyword(keyword: string, limit = 20): Promise<Episode[]> {
    const lower = keyword.toLowerCase();
    const matches = [...this.byId.values()].filter((e) => {
      if (e.summary.toLowerCase().includes(lower)) return true;
      if (e.tags?.some((t) => t.toLowerCase().includes(lower))) return true;
      return false;
    });
    // Sort by importance descending
    matches.sort((a, b) => b.importance - a.importance);
    return matches.slice(0, limit);
  }

  async pruneBelow(importanceThreshold: number): Promise<number> {
    let pruned = 0;
    for (const [id, episode] of this.byId) {
      if (episode.importance < importanceThreshold) {
        this.byId.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  async count(): Promise<number> {
    return this.byId.size;
  }
}
