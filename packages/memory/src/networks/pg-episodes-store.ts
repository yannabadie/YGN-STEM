// Integration tests require PostgreSQL — run with: pnpm test:integration
import { eq, lt, ilike, desc, count } from "drizzle-orm";
import type { Episode } from "@ygn-stem/shared";
import type { Database } from "../db/connection.js";
import { episodes } from "../db/schema.js";
import type { IEpisodesStore } from "./episodes-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rowToEpisode(row: typeof episodes.$inferSelect): Episode {
  return {
    id: row.id,
    callerId: row.callerId,
    requestId: row.requestId,
    summary: row.summary,
    importance: row.importance,
    timestamp: row.timestamp.toISOString(),
    embedding: row.embedding ?? undefined,
    tags: row.tags ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// PgEpisodesStore
// ---------------------------------------------------------------------------
export class PgEpisodesStore implements IEpisodesStore {
  constructor(private readonly db: Database) {}

  async store(episode: Episode): Promise<Episode> {
    await this.db
      .insert(episodes)
      .values({
        id: episode.id,
        callerId: episode.callerId,
        requestId: episode.requestId,
        summary: episode.summary,
        importance: episode.importance,
        timestamp: new Date(episode.timestamp),
        embedding: episode.embedding,
        tags: episode.tags ?? [],
      })
      .onConflictDoUpdate({
        target: episodes.id,
        set: {
          summary: episode.summary,
          importance: episode.importance,
          timestamp: new Date(episode.timestamp),
          embedding: episode.embedding,
          tags: episode.tags ?? [],
        },
      });
    return episode;
  }

  async getById(id: string): Promise<Episode | undefined> {
    const rows = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.id, id));
    return rows[0] ? rowToEpisode(rows[0]) : undefined;
  }

  async searchByCaller(callerId: string, limit = 50): Promise<Episode[]> {
    const rows = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.callerId, callerId))
      .orderBy(desc(episodes.timestamp))
      .limit(limit);
    return rows.map(rowToEpisode);
  }

  async searchByKeyword(keyword: string, limit = 20): Promise<Episode[]> {
    // ilike on summary field for case-insensitive substring match
    const rows = await this.db
      .select()
      .from(episodes)
      .where(ilike(episodes.summary, `%${keyword}%`))
      .orderBy(desc(episodes.importance))
      .limit(limit);
    return rows.map(rowToEpisode);
  }

  async pruneBelow(importanceThreshold: number): Promise<number> {
    const deleted = await this.db
      .delete(episodes)
      .where(lt(episodes.importance, importanceThreshold))
      .returning({ id: episodes.id });
    return deleted.length;
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(episodes);
    return result[0]?.count ?? 0;
  }
}
