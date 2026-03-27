import {
  pgTable,
  text,
  real,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Facts table — knowledge graph triples (subject / predicate / object)
// ---------------------------------------------------------------------------
export const facts = pgTable(
  "facts",
  {
    id: text("id").primaryKey(),
    subject: text("subject").notNull(),
    predicate: text("predicate").notNull(),
    object: text("object").notNull(),
    confidence: real("confidence").notNull().default(1.0),
    sourceId: text("source_id"),
    embedding: jsonb("embedding").$type<number[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("facts_spo_idx").on(t.subject, t.predicate, t.object),
    index("facts_subject_idx").on(t.subject),
    index("facts_predicate_idx").on(t.predicate),
  ],
);

export type FactRow = typeof facts.$inferSelect;
export type NewFactRow = typeof facts.$inferInsert;

// ---------------------------------------------------------------------------
// Episodes table — episodic memory entries
// ---------------------------------------------------------------------------
export const episodes = pgTable(
  "episodes",
  {
    id: text("id").primaryKey(),
    callerId: text("caller_id").notNull(),
    requestId: text("request_id").notNull(),
    summary: text("summary").notNull(),
    importance: real("importance").notNull().default(0.5),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    embedding: jsonb("embedding").$type<number[]>(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("episodes_caller_idx").on(t.callerId),
    index("episodes_timestamp_idx").on(t.timestamp),
    index("episodes_importance_idx").on(t.importance),
  ],
);

export type EpisodeRow = typeof episodes.$inferSelect;
export type NewEpisodeRow = typeof episodes.$inferInsert;

// ---------------------------------------------------------------------------
// Summaries table — compressed entity summaries
// ---------------------------------------------------------------------------
export const summaries = pgTable(
  "summaries",
  {
    entityId: text("entity_id").primaryKey(),
    entityType: text("entity_type").notNull(),
    summary: text("summary").notNull(),
    cueAnchors: jsonb("cue_anchors").$type<string[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull(),
    embedding: jsonb("embedding").$type<number[]>(),
  },
  (t) => [
    index("summaries_entity_type_idx").on(t.entityType),
    index("summaries_last_updated_idx").on(t.lastUpdated),
  ],
);

export type SummaryRow = typeof summaries.$inferSelect;
export type NewSummaryRow = typeof summaries.$inferInsert;

// ---------------------------------------------------------------------------
// Caller profiles table — belief network / persona store
// ---------------------------------------------------------------------------
export const callerProfiles = pgTable(
  "caller_profiles",
  {
    callerId: text("caller_id").primaryKey(),
    dimensions: jsonb("dimensions")
      .$type<
        Array<{
          key: string;
          value: string;
          confidence: number;
          evidence?: string[];
        }>
      >()
      .notNull()
      .default([]),
    interactionCount: integer("interaction_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("caller_profiles_updated_idx").on(t.updatedAt)],
);

export type CallerProfileRow = typeof callerProfiles.$inferSelect;
export type NewCallerProfileRow = typeof callerProfiles.$inferInsert;

// ---------------------------------------------------------------------------
// Skills table — skill maturity tracking
// ---------------------------------------------------------------------------
export const skills = pgTable(
  "skills",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    maturity: text("maturity").notNull().default("nascent"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    version: text("version").notNull().default("0.1.0"),
    organId: text("organ_id"),
    successRate: real("success_rate"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("skills_maturity_idx").on(t.maturity),
    index("skills_organ_idx").on(t.organId),
  ],
);

export type SkillRow = typeof skills.$inferSelect;
export type NewSkillRow = typeof skills.$inferInsert;
