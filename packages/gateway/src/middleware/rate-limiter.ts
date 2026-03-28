export interface RateLimiterOptions {
  windowMs?: number;       // default 60000 (1 minute)
  maxRequests?: number;    // default 100 per window
  keyExtractor?: (req: any) => string;  // default: X-Caller-Id or IP
}

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 100;
  const buckets = new Map<string, BucketEntry>();

  // Periodic cleanup of stale buckets
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now - entry.lastRefill > windowMs * 2) buckets.delete(key);
    }
  }, windowMs);
  cleanup.unref();  // Don't keep process alive for cleanup

  return (req: any, res: any, next: any): void => {
    const key = options.keyExtractor?.(req)
      ?? (req as any).callerId
      ?? req.ip
      ?? "unknown";

    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry) {
      entry = { tokens: maxRequests, lastRefill: now };
      buckets.set(key, entry);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - entry.lastRefill;
    const refill = Math.floor((elapsed / windowMs) * maxRequests);
    if (refill > 0) {
      entry.tokens = Math.min(maxRequests, entry.tokens + refill);
      entry.lastRefill = now;
    }

    if (entry.tokens <= 0) {
      res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil(windowMs / 1000),
      });
      return;
    }

    entry.tokens--;
    res.setHeader("X-RateLimit-Remaining", entry.tokens);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    next();
  };
}
