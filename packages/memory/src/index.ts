export {
  HindsightMemory,
  type HindsightStores,
  type RecallNetwork,
  type RecallQuery,
  type RecallResult,
  type RetainInput,
  type ReflectOptions,
  type ReflectStats,
} from "./hindsight.js";
export {
  InMemoryFactsStore,
  type IFactsStore,
  type StoredFact,
  type FactSearchOptions,
} from "./networks/facts-store.js";
export {
  InMemoryEpisodesStore,
  type IEpisodesStore,
  type ImportanceFactors,
} from "./networks/episodes-store.js";
export {
  InMemorySummariesStore,
  type ISummariesStore,
  type StoredSummary,
} from "./networks/summaries-store.js";
export {
  InMemoryBeliefsStore,
  type IBeliefsStore,
  type StoredCallerProfile,
} from "./networks/beliefs-store.js";
export { PgFactsStore } from "./networks/pg-facts-store.js";
export { PgEpisodesStore } from "./networks/pg-episodes-store.js";
export { PgSummariesStore } from "./networks/pg-summaries-store.js";
export { PgBeliefsStore } from "./networks/pg-beliefs-store.js";
export * from "./db/schema.js";
export { createDb, type Database } from "./db/connection.js";

// Embedding service
export { type EmbeddingProvider } from "./embeddings/types.js";
export { HashEmbeddingProvider } from "./embeddings/hash-provider.js";
export { cosineSimilarity } from "./embeddings/similarity.js";

// Retrieval algorithms
export { ucbScore, rankByUCB, type UCBEntry } from "./retrieval/ucb.js";
export {
  reciprocalRankFusion,
  type RankedItem,
} from "./retrieval/rrf.js";
