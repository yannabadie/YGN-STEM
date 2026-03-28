import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createRateLimiter } from "../middleware/rate-limiter.js";

function makeApp(options: Parameters<typeof createRateLimiter>[0] = {}) {
  const app = express();
  app.use(createRateLimiter(options));
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("Rate limiter middleware", () => {
  it("allows requests within the limit", async () => {
    const app = makeApp({ maxRequests: 5, windowMs: 60_000 });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/test");
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 when limit is exceeded", async () => {
    const app = makeApp({ maxRequests: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      await request(app).get("/test");
    }

    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Too many requests");
    expect(res.body.retryAfter).toBe(60);
  });

  it("sets X-RateLimit-Remaining and X-RateLimit-Limit headers", async () => {
    const app = makeApp({ maxRequests: 10, windowMs: 60_000 });

    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBe("10");
    expect(res.headers["x-ratelimit-remaining"]).toBe("9");

    const res2 = await request(app).get("/test");
    expect(res2.headers["x-ratelimit-remaining"]).toBe("8");
  });

  it("different callers (by IP) have separate limits", async () => {
    // Use keyExtractor to simulate different callers
    let callCount = 0;
    const app = makeApp({
      maxRequests: 1,
      windowMs: 60_000,
      keyExtractor: () => `caller-${callCount < 1 ? "a" : "b"}`,
    });

    // First caller — gets their token
    callCount = 0;
    const res1 = await request(app).get("/test");
    expect(res1.status).toBe(200);

    // Second caller — has their own fresh bucket
    callCount = 1;
    const res2 = await request(app).get("/test");
    expect(res2.status).toBe(200);
  });

  it("uses custom keyExtractor", async () => {
    const app = express();
    app.use(
      createRateLimiter({
        maxRequests: 2,
        windowMs: 60_000,
        keyExtractor: (req) => req.headers["x-caller-id"] as string ?? "anon",
      }),
    );
    app.get("/test", (_req, res) => res.json({ ok: true }));

    // alice has her own bucket
    await request(app).get("/test").set("x-caller-id", "alice");
    await request(app).get("/test").set("x-caller-id", "alice");
    const exhausted = await request(app).get("/test").set("x-caller-id", "alice");
    expect(exhausted.status).toBe(429);

    // bob is unaffected
    const bobRes = await request(app).get("/test").set("x-caller-id", "bob");
    expect(bobRes.status).toBe(200);
  });

  it("refills tokens after the window elapses", async () => {
    vi.useFakeTimers();

    const app = makeApp({ maxRequests: 2, windowMs: 1_000 });

    // Drain the bucket
    await request(app).get("/test");
    await request(app).get("/test");
    const blocked = await request(app).get("/test");
    expect(blocked.status).toBe(429);

    // Advance time by one full window
    vi.advanceTimersByTime(1_001);

    // Should be allowed again
    const allowed = await request(app).get("/test");
    expect(allowed.status).toBe(200);

    vi.useRealTimers();
  });
});
