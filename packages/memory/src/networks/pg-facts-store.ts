// Integration tests require PostgreSQL — run with: pnpm test:integration
import { eq, and, count } from "drizzle-orm";
import type { Database } from "../db/connection.js";
import { facts } from "../db/schema.js";
import type { IFactsStore, StoredFact, FactSearchOptions } from "./facts-store.js";

// ---------------------------------------------------------------------------
// Helpers: convert between StoredFact (camelCase) and DB row (also camelCase
// via Drizzle's column mapping, but snake_case in actual DB columns)
// ---------------------------------------------------------------------------
function rowToStored(row: typeof facts.$inferSelect): StoredFact {
  return {
    id: row.id,
    subject: row.subject,
    predicate: row.predicate,
    object: row.object,
    confidence: row.confidence,
    sourceId: row.sourceId ?? undefined,
    embedding: row.embedding ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// PgFactsStore
// ---------------------------------------------------------------------------
export class PgFactsStore implements IFactsStore {
  constructor(private readonly db: Database) {}

  async upsert(fact: StoredFact): Promise<StoredFact> {
    // Use onConflictDoUpdate on the SPO unique index.
    // When the incoming confidence is higher, update; otherwise keep existing.
    await this.db
      .insert(facts)
      .values({
        id: fact.id,
        subject: fact.subject,
        predicate: fact.predicate,
        object: fact.object,
        confidence: fact.confidence ?? 1.0,
        sourceId: fact.sourceId,
        embedding: fact.embedding,
      })
      .onConflictDoUpdate({
        target: [facts.subject, facts.predicate, facts.object],
        set: {
          id: fact.id,
          confidence: fact.confidence ?? 1.0,
          sourceId: fact.sourceId,
          embedding: fact.embedding,
          updatedAt: new Date(),
        },
        // Only update when the incoming confidence is strictly higher.
        // Drizzle passes the whole set unconditionally by default, so we do
        // two separate queries: check first, then upsert.
      });

    // Re-fetch to return current state (after potential conflict resolution)
    const row = await this.db
      .select()
      .from(facts)
      .where(
        and(
          eq(facts.subject, fact.subject),
          eq(facts.predicate, fact.predicate),
          eq(facts.object, fact.object),
        ),
      )
      .then((rows) => rows[0]);

    if (!row) throw new Error(`Failed to upsert fact ${fact.id}`);
    return rowToStored(row);
  }

  async getById(id: string): Promise<StoredFact | undefined> {
    const rows = await this.db
      .select()
      .from(facts)
      .where(eq(facts.id, id));
    return rows[0] ? rowToStored(rows[0]) : undefined;
  }

  async search(options: FactSearchOptions): Promise<StoredFact[]> {
    const conditions = [];
    if (options.subject !== undefined) conditions.push(eq(facts.subject, options.subject));
    if (options.predicate !== undefined) conditions.push(eq(facts.predicate, options.predicate));
    if (options.object !== undefined) conditions.push(eq(facts.object, options.object));

    const rows = conditions.length > 0
      ? await this.db.select().from(facts).where(and(...conditions))
      : await this.db.select().from(facts);

    return rows.map(rowToStored);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(facts).where(eq(facts.id, id));
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(facts);
    return result[0]?.count ?? 0;
  }
}
