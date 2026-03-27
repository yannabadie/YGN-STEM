import type { Episode, FactTriple } from "@ygn-stem/shared";
import type { IFactsStore, StoredFact } from "./networks/facts-store.js";
import type { IEpisodesStore } from "./networks/episodes-store.js";
import type { ISummariesStore } from "./networks/summaries-store.js";
import type { IBeliefsStore } from "./networks/beliefs-store.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HindsightStores {
  facts: IFactsStore;
  episodes: IEpisodesStore;
  summaries: ISummariesStore;
  beliefs: IBeliefsStore;
}

/** Which networks to include in a recall query. */
export type RecallNetwork = "facts" | "episodes" | "summaries" | "beliefs";

export interface RecallQuery {
  query: string;
  callerId: string;
  limit?: number;
  networks?: RecallNetwork[];
}

export interface RecallResult {
  episodes: Episode[];
  facts: FactTriple[];
  totalFound: number;
}

export interface RetainInput {
  episode: Episode;
  extractedTriples?: FactTriple[];
}

export interface ReflectOptions {
  importanceThreshold?: number;
}

export interface ReflectStats {
  episodesPruned: number;
  importanceThreshold: number;
}

// ---------------------------------------------------------------------------
// HindsightMemory manager
// ---------------------------------------------------------------------------

export class HindsightMemory {
  private readonly facts: IFactsStore;
  private readonly episodes: IEpisodesStore;
  private readonly summaries: ISummariesStore;
  private readonly beliefs: IBeliefsStore;

  constructor(stores: HindsightStores) {
    this.facts = stores.facts;
    this.episodes = stores.episodes;
    this.summaries = stores.summaries;
    this.beliefs = stores.beliefs;
  }

  // -------------------------------------------------------------------------
  // RETAIN — store new experience + optional extracted knowledge
  // -------------------------------------------------------------------------

  async retain(input: RetainInput): Promise<void> {
    // Always store the episode
    await this.episodes.store(input.episode);

    // Optionally store extracted triples in the facts network
    if (input.extractedTriples !== undefined && input.extractedTriples.length > 0) {
      for (const triple of input.extractedTriples) {
        const storedFact: StoredFact = {
          ...triple,
          id: `${triple.subject}::${triple.predicate}::${triple.object}`,
        };
        await this.facts.upsert(storedFact);
      }
    }
  }

  // -------------------------------------------------------------------------
  // RECALL — search across selected networks and merge results
  // -------------------------------------------------------------------------

  async recall(query: RecallQuery): Promise<RecallResult> {
    const networks = query.networks ?? ["facts", "episodes", "summaries", "beliefs"];
    const limit = query.limit ?? 20;

    let episodeResults: Episode[] = [];
    let factResults: FactTriple[] = [];

    if (networks.includes("episodes")) {
      // Search by caller and by keyword, then merge unique results
      const byCaller = await this.episodes.searchByCaller(query.callerId, limit);
      const byKeyword = await this.episodes.searchByKeyword(query.query, limit);

      const seen = new Set<string>();
      const merged: Episode[] = [];
      for (const ep of [...byCaller, ...byKeyword]) {
        if (!seen.has(ep.id)) {
          seen.add(ep.id);
          merged.push(ep);
        }
      }
      episodeResults = merged.slice(0, limit);
    }

    if (networks.includes("facts")) {
      // Search facts by subject or object matching the query string
      const bySubject = await this.facts.search({ subject: query.query });
      const byObject = await this.facts.search({ object: query.query });
      const seen = new Set<string>();
      const merged: FactTriple[] = [];
      for (const fact of [...bySubject, ...byObject]) {
        const key = `${fact.subject}|${fact.predicate}|${fact.object}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(fact);
        }
      }
      factResults = merged.slice(0, limit);
    }

    return {
      episodes: episodeResults,
      facts: factResults,
      totalFound: episodeResults.length + factResults.length,
    };
  }

  // -------------------------------------------------------------------------
  // REFLECT — prune low-importance episodes and report statistics
  // -------------------------------------------------------------------------

  async reflect(options: ReflectOptions = {}): Promise<ReflectStats> {
    const importanceThreshold = options.importanceThreshold ?? 0.3;
    const episodesPruned = await this.episodes.pruneBelow(importanceThreshold);
    return { episodesPruned, importanceThreshold };
  }
}
