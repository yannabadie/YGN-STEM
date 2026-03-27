// Integration tests require PostgreSQL — run with: pnpm test:integration
import { eq, count, sql } from "drizzle-orm";
import type { EntitySummary } from "@ygn-stem/shared";
import type { Database } from "../db/connection.js";
import { summaries } from "../db/schema.js";
import type { ISummariesStore, StoredSummary } from "./summaries-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rowToStored(row: typeof summaries.$inferSelect): StoredSummary {
  return {
    entityId: row.entityId,
    entityType: row.entityType,
    summary: row.summary,
    cueAnchors: row.cueAnchors ?? [],
    lastUpdated: row.lastUpdated.toISOString(),
    embedding: row.embedding ?? undefined,
    version: row.version,
  };
}

// ---------------------------------------------------------------------------
// PgSummariesStore
// ---------------------------------------------------------------------------
export class PgSummariesStore implements ISummariesStore {
  constructor(private readonly db: Database) {}

  async upsert(summary: EntitySummary): Promise<StoredSummary> {
    // Get current version to increment it
    const existing = await this.db
      .select({ version: summaries.version })
      .from(summaries)
      .where(eq(summaries.entityId, summary.entityId))
      .then((rows) => rows[0]);

    const nextVersion = existing !== undefined ? existing.version + 1 : 1;

    const rows = await this.db
      .insert(summaries)
      .values({
        entityId: summary.entityId,
        entityType: summary.entityType,
        summary: summary.summary,
        cueAnchors: summary.cueAnchors,
        lastUpdated: new Date(summary.lastUpdated),
        embedding: summary.embedding,
        version: nextVersion,
      })
      .onConflictDoUpdate({
        target: summaries.entityId,
        set: {
          entityType: summary.entityType,
          summary: summary.summary,
          cueAnchors: summary.cueAnchors,
          lastUpdated: new Date(summary.lastUpdated),
          embedding: summary.embedding,
          version: sql`${summaries.version} + 1`,
        },
      })
      .returning();

    if (!rows[0]) throw new Error(`Failed to upsert summary ${summary.entityId}`);
    return rowToStored(rows[0]);
  }

  async getById(entityId: string): Promise<StoredSummary | undefined> {
    const rows = await this.db
      .select()
      .from(summaries)
      .where(eq(summaries.entityId, entityId));
    return rows[0] ? rowToStored(rows[0]) : undefined;
  }

  async searchByCueAnchor(anchor: string): Promise<StoredSummary[]> {
    // Fetch all and filter in-process (cueAnchors is a jsonb array).
    // For a large dataset this could use a PG jsonb contains operator instead.
    const lower = anchor.toLowerCase();
    const rows = await this.db.select().from(summaries);
    return rows
      .filter((row) =>
        (row.cueAnchors ?? []).some((ca) => ca.toLowerCase().includes(lower)),
      )
      .map(rowToStored);
  }

  async searchByType(entityType: string): Promise<StoredSummary[]> {
    const rows = await this.db
      .select()
      .from(summaries)
      .where(eq(summaries.entityType, entityType));
    return rows.map(rowToStored);
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(summaries);
    return result[0]?.count ?? 0;
  }
}
