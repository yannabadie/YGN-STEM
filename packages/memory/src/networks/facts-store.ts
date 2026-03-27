import type { FactTriple } from "@ygn-stem/shared";

// ---------------------------------------------------------------------------
// Stored fact — extends FactTriple with a stable id
// ---------------------------------------------------------------------------
export interface StoredFact extends FactTriple {
  id: string;
}

export interface FactSearchOptions {
  subject?: string | undefined;
  predicate?: string | undefined;
  object?: string | undefined;
}

// ---------------------------------------------------------------------------
// IFactsStore contract
// ---------------------------------------------------------------------------
export interface IFactsStore {
  /**
   * Insert or update a fact.  Deduplicates on subject+predicate+object;
   * when a match exists, keeps the entry with higher confidence.
   */
  upsert(fact: StoredFact): Promise<StoredFact>;

  /** Look up a single fact by its id.  Returns undefined when not found. */
  getById(id: string): Promise<StoredFact | undefined>;

  /**
   * Filter facts by any combination of subject, predicate, or object.
   * Omitting a field means "match any value for that field".
   */
  search(options: FactSearchOptions): Promise<StoredFact[]>;

  /** Remove a fact.  No-ops silently when the id does not exist. */
  delete(id: string): Promise<void>;

  /** Total number of facts currently stored. */
  count(): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------
export class InMemoryFactsStore implements IFactsStore {
  private readonly byId = new Map<string, StoredFact>();
  /** secondary index: "subject|predicate|object" → id */
  private readonly bySpo = new Map<string, string>();

  async upsert(fact: StoredFact): Promise<StoredFact> {
    const spoKey = `${fact.subject}|${fact.predicate}|${fact.object}`;
    const existingId = this.bySpo.get(spoKey);

    if (existingId !== undefined) {
      const existing = this.byId.get(existingId);
      if (existing !== undefined) {
        // Keep the entry with higher confidence
        const existingConf = existing.confidence ?? 1;
        const incomingConf = fact.confidence ?? 1;
        if (incomingConf > existingConf) {
          const updated: StoredFact = { ...fact, id: existingId };
          this.byId.set(existingId, updated);
          return updated;
        }
        return existing;
      }
    }

    // New fact
    this.byId.set(fact.id, fact);
    this.bySpo.set(spoKey, fact.id);
    return fact;
  }

  async getById(id: string): Promise<StoredFact | undefined> {
    return this.byId.get(id);
  }

  async search(options: FactSearchOptions): Promise<StoredFact[]> {
    const results: StoredFact[] = [];
    for (const fact of this.byId.values()) {
      if (options.subject !== undefined && fact.subject !== options.subject) continue;
      if (options.predicate !== undefined && fact.predicate !== options.predicate) continue;
      if (options.object !== undefined && fact.object !== options.object) continue;
      results.push(fact);
    }
    return results;
  }

  async delete(id: string): Promise<void> {
    const fact = this.byId.get(id);
    if (fact === undefined) return;
    const spoKey = `${fact.subject}|${fact.predicate}|${fact.object}`;
    this.byId.delete(id);
    this.bySpo.delete(spoKey);
  }

  async count(): Promise<number> {
    return this.byId.size;
  }
}
