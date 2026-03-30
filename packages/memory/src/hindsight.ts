import type { Episode, FactTriple } from "@ygn-stem/shared";
import type { IFactsStore, StoredFact } from "./networks/facts-store.js";
import type { IEpisodesStore } from "./networks/episodes-store.js";
import type { ISummariesStore } from "./networks/summaries-store.js";
import type { IBeliefsStore } from "./networks/beliefs-store.js";
import type { EmbeddingProvider } from "./embeddings/types.js";
import { cosineSimilarity } from "./embeddings/similarity.js";
import { ucbScore, type UCBEntry } from "./retrieval/ucb.js";
import {
  reciprocalRankFusion,
  type RankedItem,
} from "./retrieval/rrf.js";
import type { MemoryCache } from "./redis/redis-cache.js";

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
  private readonly embeddingProvider: EmbeddingProvider | undefined;
  private readonly cache: MemoryCache | undefined;

  /** Track hit counts and reward sums for UCB scoring, keyed by item id. */
  private readonly ucbStats = new Map<
    string,
    { hitCount: number; rewardSum: number }
  >();
  /** Total number of recall queries processed (for UCB exploration term). */
  private totalQueries = 0;

  constructor(
    stores: HindsightStores,
    embeddingProvider?: EmbeddingProvider,
    cache?: MemoryCache,
  ) {
    this.facts = stores.facts;
    this.episodes = stores.episodes;
    this.summaries = stores.summaries;
    this.beliefs = stores.beliefs;
    this.embeddingProvider = embeddingProvider;
    this.cache = cache;
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
    // Check cache first
    if (this.cache !== undefined) {
      const { MemoryCache } = await import("./redis/redis-cache.js");
      const cacheKey = MemoryCache.recallKey(query.callerId, query.query);
      const cached = await this.cache.get<RecallResult>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const result = this.embeddingProvider
        ? await this.vectorRecall(query)
        : await this.keywordRecall(query);

      await this.cache.set(cacheKey, result, 300);
      return result;
    }

    if (this.embeddingProvider) {
      return this.vectorRecall(query);
    }
    return this.keywordRecall(query);
  }

  // -------------------------------------------------------------------------
  // REFLECT — prune low-importance episodes and report statistics
  // -------------------------------------------------------------------------

  async reflect(options: ReflectOptions = {}): Promise<ReflectStats> {
    const importanceThreshold = options.importanceThreshold ?? 0.3;
    const episodesPruned = await this.episodes.pruneBelow(importanceThreshold);
    return { episodesPruned, importanceThreshold };
  }

  // -------------------------------------------------------------------------
  // Private — keyword recall (original behavior)
  // -------------------------------------------------------------------------

  private async keywordRecall(query: RecallQuery): Promise<RecallResult> {
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
  // Private — vector recall (embedding + UCB + RRF)
  // -------------------------------------------------------------------------

  private async vectorRecall(query: RecallQuery): Promise<RecallResult> {
    const networks = query.networks ?? ["facts", "episodes", "summaries", "beliefs"];
    const limit = query.limit ?? 20;

    this.totalQueries++;

    // Embed the query text
    const queryEmbedding = await this.embeddingProvider!.embedSingle(query.query);

    const rankedLists: RankedItem[][] = [];

    // --- Episode vector search ---
    if (networks.includes("episodes")) {
      // Gather candidate episodes via existing search methods (broad pre-filter)
      const byCaller = await this.episodes.searchByCaller(query.callerId, limit * 5);
      const byKeyword = await this.episodes.searchByKeyword(query.query, limit * 5);

      const seen = new Set<string>();
      const candidates: Episode[] = [];
      for (const ep of [...byCaller, ...byKeyword]) {
        if (!seen.has(ep.id)) {
          seen.add(ep.id);
          candidates.push(ep);
        }
      }

      // Compute similarity and apply UCB scoring
      const scored: { episode: Episode; score: number }[] = [];
      for (const ep of candidates) {
        const sim = ep.embedding
          ? cosineSimilarity(queryEmbedding, ep.embedding)
          : 0;
        const stats = this.ucbStats.get(ep.id) ?? { hitCount: 0, rewardSum: 0 };
        const ucbEntry: UCBEntry = {
          id: ep.id,
          similarity: sim,
          hitCount: stats.hitCount,
          rewardSum: stats.rewardSum,
          totalQueries: this.totalQueries,
        };
        scored.push({ episode: ep, score: ucbScore(ucbEntry) });
      }

      // Sort by UCB score descending
      scored.sort((a, b) => b.score - a.score);

      // Build ranked list for RRF
      const episodeRanked: RankedItem[] = scored.map((s, i) => ({
        id: s.episode.id,
        source: "episodes",
        rank: i + 1,
        originalScore: s.score,
        item: s.episode,
      }));
      rankedLists.push(episodeRanked);

      // Track hits for returned episodes
      for (const s of scored.slice(0, limit)) {
        const stats = this.ucbStats.get(s.episode.id) ?? {
          hitCount: 0,
          rewardSum: 0,
        };
        this.ucbStats.set(s.episode.id, {
          hitCount: stats.hitCount + 1,
          rewardSum: stats.rewardSum,
        });
      }
    }

    // --- Facts vector search ---
    if (networks.includes("facts")) {
      // Use existing search as pre-filter for facts
      const bySubject = await this.facts.search({ subject: query.query });
      const byObject = await this.facts.search({ object: query.query });

      // Also do a broader keyword-based search by searching for each word
      const words = query.query.split(/\s+/).filter((w) => w.length > 1);
      const additionalFacts: StoredFact[] = [];
      for (const word of words) {
        const bySub = await this.facts.search({ subject: word });
        const byObj = await this.facts.search({ object: word });
        additionalFacts.push(...bySub, ...byObj);
      }

      const seen = new Set<string>();
      const candidates: StoredFact[] = [];
      for (const fact of [...bySubject, ...byObject, ...additionalFacts]) {
        const key = `${fact.subject}|${fact.predicate}|${fact.object}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(fact);
        }
      }

      // For facts, use confidence as a proxy for similarity scoring
      // (facts don't store embeddings in the current schema)
      const factRanked: RankedItem[] = candidates
        .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
        .map((f, i) => ({
          id: f.id,
          source: "facts",
          rank: i + 1,
          originalScore: f.confidence ?? 0.5,
          item: f,
        }));
      rankedLists.push(factRanked);
    }

    // --- Fuse results with RRF ---
    const fused = reciprocalRankFusion(rankedLists);

    // Separate back into episodes and facts
    const episodeResults: Episode[] = [];
    const factResults: FactTriple[] = [];

    for (const entry of fused) {
      if (episodeResults.length + factResults.length >= limit) break;
      const sources = entry.sources;
      if (sources.includes("episodes")) {
        episodeResults.push(entry.item as Episode);
      } else if (sources.includes("facts")) {
        const storedFact = entry.item as StoredFact;
        factResults.push({
          subject: storedFact.subject,
          predicate: storedFact.predicate,
          object: storedFact.object,
          confidence: storedFact.confidence,
          sourceId: storedFact.sourceId,
        });
      }
    }

    return {
      episodes: episodeResults,
      facts: factResults,
      totalFound: episodeResults.length + factResults.length,
    };
  }
}
