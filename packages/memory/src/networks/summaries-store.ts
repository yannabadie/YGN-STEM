import type { EntitySummary } from "@ygn-stem/shared";

// ---------------------------------------------------------------------------
// Stored summary — EntitySummary extended with a mutable version counter
// ---------------------------------------------------------------------------
export interface StoredSummary extends EntitySummary {
  version: number;
}

// ---------------------------------------------------------------------------
// ISummariesStore contract
// ---------------------------------------------------------------------------
export interface ISummariesStore {
  /**
   * Insert or update a summary.
   * When an entry with the same entityId already exists, the version is
   * auto-incremented and all fields are replaced with the incoming values.
   */
  upsert(summary: EntitySummary): Promise<StoredSummary>;

  /** Look up a summary by entity id.  Returns undefined when not found. */
  getById(entityId: string): Promise<StoredSummary | undefined>;

  /**
   * Find summaries whose cueAnchors array contains a string that
   * case-insensitively includes the given anchor substring.
   */
  searchByCueAnchor(anchor: string): Promise<StoredSummary[]>;

  /** Return all summaries for a given entity type. */
  searchByType(entityType: string): Promise<StoredSummary[]>;

  /** Total number of summaries currently stored. */
  count(): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------
export class InMemorySummariesStore implements ISummariesStore {
  private readonly byId = new Map<string, StoredSummary>();

  async upsert(summary: EntitySummary): Promise<StoredSummary> {
    const existing = this.byId.get(summary.entityId);
    const stored: StoredSummary = {
      ...summary,
      version: existing !== undefined ? existing.version + 1 : 1,
    };
    this.byId.set(summary.entityId, stored);
    return stored;
  }

  async getById(entityId: string): Promise<StoredSummary | undefined> {
    return this.byId.get(entityId);
  }

  async searchByCueAnchor(anchor: string): Promise<StoredSummary[]> {
    const lower = anchor.toLowerCase();
    return [...this.byId.values()].filter((s) =>
      s.cueAnchors.some((ca) => ca.toLowerCase().includes(lower)),
    );
  }

  async searchByType(entityType: string): Promise<StoredSummary[]> {
    return [...this.byId.values()].filter(
      (s) => s.entityType === entityType,
    );
  }

  async count(): Promise<number> {
    return this.byId.size;
  }
}
