import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { OrganRegistry, BaseConnector } from "@ygn-stem/connectors";
import type {
  OrganConfig,
  OrganInfo,
  OrganStatus,
  ToolDescriptor,
} from "@ygn-stem/shared";
import { createGateway } from "../gateway.js";

// ---------------------------------------------------------------------------
// MockConnector for testing
// ---------------------------------------------------------------------------
class MockConnector extends BaseConnector {
  private readonly _mockTools: ToolDescriptor[];
  private readonly _mockInfo: OrganInfo;

  constructor(config: OrganConfig, mockTools: ToolDescriptor[] = []) {
    super(config);
    this._mockTools = mockTools;
    this._mockInfo = {
      organId: config.organId,
      name: config.organId,
      status: "healthy" as OrganStatus,
      transport: config.transport,
      version: "0.1.0",
    };
  }

  protected async doConnect(): Promise<void> {
    // no-op
  }
  protected async doDisconnect(): Promise<void> {
    // no-op
  }
  protected async doCallTool(
    _name: string,
    _args: Record<string, unknown>,
  ): Promise<unknown> {
    return { result: "mock-result" };
  }
  protected async doHealth(): Promise<OrganStatus> {
    return "healthy";
  }
  protected async doListTools(): Promise<ToolDescriptor[]> {
    return this._mockTools;
  }
  protected async doInfo(): Promise<OrganInfo> {
    return this._mockInfo;
  }
}

const makeConfig = (id: string): OrganConfig => ({
  organId: id,
  transport: "http",
  endpoint: `http://localhost/${id}`,
  timeoutMs: 5000,
});

const toolA: ToolDescriptor = {
  name: "echo",
  description: "Echo a message",
  inputSchema: { type: "object", properties: { message: { type: "string" } } },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Gateway integration", () => {
  let registry: OrganRegistry;

  beforeEach(() => {
    registry = new OrganRegistry();
  });

  // ---- Health ---------------------------------------------------------------

  it("GET /health returns 200 with status ok", async () => {
    const app = createGateway({ registry });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("organs");
    expect(Array.isArray(res.body.organs)).toBe(true);
  });

  it("GET /organs returns empty array when no organs registered", async () => {
    const app = createGateway({ registry });
    const res = await request(app).get("/organs");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /organs returns organs after registration", async () => {
    const connector = new MockConnector(makeConfig("organ-1"), [toolA]);
    await registry.register(connector);
    const app = createGateway({ registry });
    const res = await request(app).get("/organs");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].organId).toBe("organ-1");
  });

  // ---- A2A ------------------------------------------------------------------

  it("GET /.well-known/agent.json returns agent card with name YGN-STEM", async () => {
    const app = createGateway({ registry });
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("YGN-STEM");
    expect(res.body).toHaveProperty("description");
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("capabilities");
    expect(Array.isArray(res.body.capabilities)).toBe(true);
  });

  it("GET /.well-known/agent.json includes registered tool names as skills", async () => {
    const connector = new MockConnector(makeConfig("organ-2"), [toolA]);
    await registry.register(connector);
    const app = createGateway({ registry });
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.status).toBe(200);
    expect(res.body.skills).toContain("echo");
  });

  // ---- MCP ------------------------------------------------------------------

  it("POST /mcp tools/list returns aggregated tools", async () => {
    const connector = new MockConnector(makeConfig("organ-3"), [toolA]);
    await registry.register(connector);
    const app = createGateway({ registry });

    const res = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe("2.0");
    expect(res.body.id).toBe(1);
    expect(Array.isArray(res.body.result.tools)).toBe(true);
    expect(res.body.result.tools).toHaveLength(1);
    expect(res.body.result.tools[0].name).toBe("echo");
  });

  it("POST /mcp tools/call with known tool returns result", async () => {
    const connector = new MockConnector(makeConfig("organ-4"), [toolA]);
    await registry.register(connector);
    const app = createGateway({ registry });

    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "echo", arguments: { message: "hello" } },
      });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ result: "mock-result" });
  });

  it("POST /mcp tools/call with unknown tool returns JSON-RPC error", async () => {
    const app = createGateway({ registry });

    const res = await request(app)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "no-such-tool", arguments: {} },
      });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(-32603);
    expect(res.body.error.message).toMatch(/no-such-tool/);
  });

  it("POST /mcp with unknown method returns error code -32601", async () => {
    const app = createGateway({ registry });

    const res = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 4, method: "unknown/method" });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(-32601);
  });

  it("POST /mcp with invalid JSON-RPC returns error code -32600", async () => {
    const app = createGateway({ registry });

    const res = await request(app)
      .post("/mcp")
      .send({ not_jsonrpc: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(-32600);
  });

  // ---- Request ID -----------------------------------------------------------

  it("adds X-Request-Id header to responses", async () => {
    const app = createGateway({ registry });
    const res = await request(app).get("/health");
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(typeof res.headers["x-request-id"]).toBe("string");
    expect(res.headers["x-request-id"].length).toBeGreaterThan(0);
  });

  it("echoes existing X-Request-Id header back in response", async () => {
    const app = createGateway({ registry });
    const customId = "my-custom-request-id";
    const res = await request(app)
      .get("/health")
      .set("X-Request-Id", customId);
    expect(res.headers["x-request-id"]).toBe(customId);
  });
});
