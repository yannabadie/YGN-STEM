// Integration tests require PostgreSQL — run with: pnpm test:integration
import { eq, count, sql } from "drizzle-orm";
import type { CallerProfile } from "@ygn-stem/shared";
import type { Database } from "../db/connection.js";
import { callerProfiles } from "../db/schema.js";
import type { IBeliefsStore, StoredCallerProfile } from "./beliefs-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rowToStored(row: typeof callerProfiles.$inferSelect): StoredCallerProfile {
  return {
    callerId: row.callerId,
    dimensions: row.dimensions ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    interactionCount: row.interactionCount,
  };
}

// ---------------------------------------------------------------------------
// PgBeliefsStore
// ---------------------------------------------------------------------------
export class PgBeliefsStore implements IBeliefsStore {
  constructor(private readonly db: Database) {}

  async upsert(profile: CallerProfile): Promise<StoredCallerProfile> {
    const rows = await this.db
      .insert(callerProfiles)
      .values({
        callerId: profile.callerId,
        dimensions: profile.dimensions,
        interactionCount: 1,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: callerProfiles.callerId,
        set: {
          dimensions: profile.dimensions,
          interactionCount: sql`${callerProfiles.interactionCount} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!rows[0]) throw new Error(`Failed to upsert caller profile ${profile.callerId}`);
    return rowToStored(rows[0]);
  }

  async getById(callerId: string): Promise<StoredCallerProfile | undefined> {
    const rows = await this.db
      .select()
      .from(callerProfiles)
      .where(eq(callerProfiles.callerId, callerId));
    return rows[0] ? rowToStored(rows[0]) : undefined;
  }

  async forgetCaller(callerId: string): Promise<void> {
    await this.db
      .delete(callerProfiles)
      .where(eq(callerProfiles.callerId, callerId));
  }

  async listCallerIds(): Promise<string[]> {
    const rows = await this.db
      .select({ callerId: callerProfiles.callerId })
      .from(callerProfiles);
    return rows.map((r) => r.callerId);
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(callerProfiles);
    return result[0]?.count ?? 0;
  }
}
