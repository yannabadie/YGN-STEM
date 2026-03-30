import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// In-memory fallback entry
// ---------------------------------------------------------------------------

interface MapEntry<T> {
  value: T;
  expiresAt: number; // Date.now() + ttlMs
}

// ---------------------------------------------------------------------------
// MemoryCache — Redis backend with in-memory Map fallback
// ---------------------------------------------------------------------------

export class MemoryCache {
  /** Lazily-resolved ioredis client, or null when running in-memory mode. */
  private redis: { get(k: string): Promise<string | null>; set(k: string, v: string, ex: string, ttl: number): Promise<unknown>; del(...keys: string[]): Promise<unknown>; keys(pattern: string): Promise<string[]>; quit(): Promise<unknown> } | null = null;
  private readonly fallback = new Map<string, MapEntry<unknown>>();
  private redisReady = false;

  constructor(redisUrl?: string) {
    if (redisUrl) {
      // Attempt dynamic import so the module gracefully degrades when ioredis
      // is unavailable or the URL is unreachable.
      import("ioredis")
        .then(({ default: Redis }) => {
          const client = new Redis(redisUrl, {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 0,
          });
          return client.connect().then(() => {
            this.redis = client as unknown as typeof this.redis;
            this.redisReady = true;
          });
        })
        .catch(() => {
          // Fall through to in-memory mode silently
        });
    }
  }

  // -------------------------------------------------------------------------
  // Static key generators
  // -------------------------------------------------------------------------

  /** "recall:{callerId}:{sha256_12chars_of_query}" */
  static recallKey(callerId: string, query: string): string {
    const hash = createHash("sha256").update(query).digest("hex").slice(0, 12);
    return `recall:${callerId}:${hash}`;
  }

  /** "caller:{callerId}:profile" */
  static profileKey(callerId: string): string {
    return `caller:${callerId}:profile`;
  }

  // -------------------------------------------------------------------------
  // GET
  // -------------------------------------------------------------------------

  async get<T>(key: string): Promise<T | null> {
    if (this.redisReady && this.redis !== null) {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }

    // In-memory fallback
    const entry = this.fallback.get(key) as MapEntry<T> | undefined;
    if (entry === undefined) return null;
    if (Date.now() > entry.expiresAt) {
      this.fallback.delete(key);
      return null;
    }
    return entry.value;
  }

  // -------------------------------------------------------------------------
  // SET
  // -------------------------------------------------------------------------

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.redisReady && this.redis !== null) {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    }

    // In-memory fallback
    this.fallback.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  // -------------------------------------------------------------------------
  // INVALIDATE
  // -------------------------------------------------------------------------

  async invalidate(key: string): Promise<void> {
    if (this.redisReady && this.redis !== null) {
      await this.redis.del(key);
      return;
    }
    this.fallback.delete(key);
  }

  async invalidateByPrefix(prefix: string): Promise<void> {
    if (this.redisReady && this.redis !== null) {
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return;
    }

    // In-memory fallback: iterate Map keys
    for (const key of this.fallback.keys()) {
      if (key.startsWith(prefix)) {
        this.fallback.delete(key);
      }
    }
  }

  // -------------------------------------------------------------------------
  // CLOSE
  // -------------------------------------------------------------------------

  async close(): Promise<void> {
    if (this.redisReady && this.redis !== null) {
      await this.redis.quit();
      this.redis = null;
      this.redisReady = false;
    }
    this.fallback.clear();
  }
}
