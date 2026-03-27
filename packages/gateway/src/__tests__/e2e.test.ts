/**
 * E2E integration test — exercises the full request flow through all layers.
 *
 * Uses in-memory stores (no external services required) and a standalone
 * OrganRegistry with no organs registered, validating the gateway behaves
 * correctly when running in isolation.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import {
  HindsightMemory,
  InMemoryFactsStore,
  InMemoryEpisodesStore,
  InMemorySummariesStore,
  InMemoryBeliefsStore,
} from "@ygn-stem/memory";
import { OrganRegistry } from "@ygn-stem/connectors";
import { createGateway } from "../gateway.js";
import type express from "express";

// ---------------------------------------------------------------------------
// Setup — one gateway instance shared across all E2E assertions
// ---------------------------------------------------------------------------

let app: express.Express;

beforeAll(() => {
  // 1. Create HindsightMemory with in-memory stores (no DB connection needed)
  const _memory = new HindsightMemory({
    facts: new InMemoryFactsStore(),
    episodes: new InMemoryEpisodesStore(),
    summaries: new InMemorySummariesStore(),
    beliefs: new InMemoryBeliefsStore(),
  });

  // 2. Create OrganRegistry — standalone mode, no organs registered
  const registry = new OrganRegistry();

  // 3. Create gateway
  app = createGateway({ registry });
});

// ---------------------------------------------------------------------------
// Full request-flow assertions
// ---------------------------------------------------------------------------

describe("E2E: full request flow (standalone / no organs)", () => {
  it("POST /mcp tools/list returns empty tools array", async () => {
    const res = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe("2.0");
    expect(res.body.id).toBe(1);
    expect(Array.isArray(res.body.result.tools)).toBe(true);
    expect(res.body.result.tools).toHaveLength(0);
  });

  it("GET /health returns status ok with no organs", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(Array.isArray(res.body.organs)).toBe(true);
    expect(res.body.organs).toHaveLength(0);
  });

  it("GET /.well-known/agent.json returns agent card", async () => {
    const res = await request(app).get("/.well-known/agent.json");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("YGN-STEM");
    expect(res.body).toHaveProperty("description");
    expect(res.body).toHaveProperty("version");
    expect(Array.isArray(res.body.capabilities)).toBe(true);
  });

  it("GET /organs returns empty list", async () => {
    const res = await request(app).get("/organs");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("all responses carry an X-Request-Id header", async () => {
    const endpoints: Array<{ method: "get" | "post"; path: string; body?: object }> = [
      { method: "get", path: "/health" },
      { method: "get", path: "/.well-known/agent.json" },
      { method: "get", path: "/organs" },
      {
        method: "post",
        path: "/mcp",
        body: { jsonrpc: "2.0", id: 2, method: "tools/list" },
      },
    ];

    for (const ep of endpoints) {
      let req = request(app)[ep.method](ep.path);
      if (ep.body) {
        req = (req as ReturnType<typeof request.agent>).send(ep.body) as typeof req;
      }
      const res = await req;
      expect(
        res.headers["x-request-id"],
        `${ep.method.toUpperCase()} ${ep.path} should have X-Request-Id`,
      ).toBeDefined();
      expect(typeof res.headers["x-request-id"]).toBe("string");
      expect(res.headers["x-request-id"].length).toBeGreaterThan(0);
    }
  });
});
