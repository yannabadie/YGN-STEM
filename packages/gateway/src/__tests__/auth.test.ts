import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { createHmac } from "node:crypto";
import { createAuthMiddleware } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// JWT test helper — produces a valid HS256 JWT
// ---------------------------------------------------------------------------
function makeJwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

// ---------------------------------------------------------------------------
// Small helper: build an express app with the auth middleware + a test route
// ---------------------------------------------------------------------------
function buildApp(options: Parameters<typeof createAuthMiddleware>[0]) {
  const app = express();
  app.use(createAuthMiddleware(options));
  app.get("/protected", (req, res) => {
    res.json({ ok: true, callerId: (req as any).callerId });
  });
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Auth middleware", () => {
  // ---- Public paths --------------------------------------------------------

  it("public paths bypass auth even when auth is configured", async () => {
    const app = buildApp({
      jwtSecret: "secret",
      publicPaths: ["/health"],
    });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("non-public paths are still protected when auth is configured", async () => {
    const app = buildApp({
      jwtSecret: "secret",
      publicPaths: ["/health"],
    });
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });

  // ---- API key auth --------------------------------------------------------

  it("valid API key passes and sets callerId with apikey: prefix", async () => {
    const app = buildApp({ apiKeys: new Set(["my-secret-key"]) });
    const res = await request(app).get("/protected").set("X-API-Key", "my-secret-key");
    expect(res.status).toBe(200);
    expect(res.body.callerId).toBe("apikey:my-secre");
  });

  it("invalid API key is rejected with 401", async () => {
    const app = buildApp({ apiKeys: new Set(["valid-key"]) });
    const res = await request(app).get("/protected").set("X-API-Key", "wrong-key");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("custom apiKeyHeader name is respected", async () => {
    const app = buildApp({
      apiKeys: new Set(["token123"]),
      apiKeyHeader: "X-Custom-Auth",
    });
    const res = await request(app)
      .get("/protected")
      .set("X-Custom-Auth", "token123");
    expect(res.status).toBe(200);
    expect(res.body.callerId).toMatch(/^apikey:/);
  });

  // ---- JWT auth ------------------------------------------------------------

  it("valid JWT sets callerId from sub claim", async () => {
    const secret = "test-jwt-secret";
    const token = makeJwt({ sub: "user-42", iat: Math.floor(Date.now() / 1000) }, secret);
    const app = buildApp({ jwtSecret: secret });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.callerId).toBe("user-42");
  });

  it("JWT without sub claim defaults callerId to jwt-user", async () => {
    const secret = "test-jwt-secret";
    const token = makeJwt({ role: "admin" }, secret);
    const app = buildApp({ jwtSecret: secret });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.callerId).toBe("jwt-user");
  });

  it("expired JWT is rejected with 401 and error message", async () => {
    const secret = "test-jwt-secret";
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const token = makeJwt({ sub: "user-1", exp: pastExp }, secret);
    const app = buildApp({ jwtSecret: secret });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid JWT token");
  });

  it("JWT with invalid signature is rejected with 401", async () => {
    const token = makeJwt({ sub: "attacker" }, "correct-secret");
    // Tamper: rebuild with wrong secret
    const [h, p] = token.split(".");
    const badSig = createHmac("sha256", "wrong-secret")
      .update(`${h}.${p}`)
      .digest("base64url");
    const badToken = `${h}.${p}.${badSig}`;

    const app = buildApp({ jwtSecret: "correct-secret" });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid JWT token");
  });

  it("malformed JWT (not 3 parts) is rejected with 401", async () => {
    const app = buildApp({ jwtSecret: "secret" });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer notajwt");
    expect(res.status).toBe(401);
  });

  // ---- Anonymous / no-auth mode --------------------------------------------

  it("no auth configured → anonymous access is allowed", async () => {
    const app = buildApp({});
    const res = await request(app).get("/protected");
    expect(res.status).toBe(200);
    expect(res.body.callerId).toBe("anonymous");
  });

  it("empty apiKeys set + no jwtSecret → anonymous access allowed", async () => {
    const app = buildApp({ apiKeys: new Set() });
    const res = await request(app).get("/protected");
    expect(res.status).toBe(200);
    expect(res.body.callerId).toBe("anonymous");
  });

  // ---- Auth required but missing -------------------------------------------

  it("auth required (apiKeys configured) but no credentials → 401", async () => {
    const app = buildApp({ apiKeys: new Set(["real-key"]) });
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("auth required (jwtSecret configured) but no credentials → 401", async () => {
    const app = buildApp({ jwtSecret: "secret" });
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });
});
