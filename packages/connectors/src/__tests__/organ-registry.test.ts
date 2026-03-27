import { describe, it, expect, beforeEach } from "vitest";
import { OrganRegistry } from "../organ-registry.js";
import { BaseConnector } from "../base-connector.js";
import type {
  OrganConfig,
  OrganInfo,
  OrganStatus,
  ToolDescriptor,
} from "@ygn-stem/shared";

// ---------------------------------------------------------------------------
// MockConnector — a minimal concrete implementation of BaseConnector
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
    return { result: "mock" };
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("OrganRegistry", () => {
  let registry: OrganRegistry;

  const makeConfig = (id: string): OrganConfig => ({
    organId: id,
    transport: "http",
    endpoint: `http://localhost/${id}`,
    timeoutMs: 5000,
  });

  const toolA: ToolDescriptor = {
    name: "tool-a",
    description: "Tool A",
    inputSchema: {},
  };

  const toolB: ToolDescriptor = {
    name: "tool-b",
    description: "Tool B",
    inputSchema: {},
  };

  beforeEach(() => {
    registry = new OrganRegistry();
  });

  it("registers an organ and lists it", async () => {
    const connector = new MockConnector(makeConfig("organ-1"), [toolA]);
    await registry.register(connector);

    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.organId).toBe("organ-1");
  });

  it("deregisters an organ", async () => {
    const connector = new MockConnector(makeConfig("organ-2"), [toolA]);
    await registry.register(connector);
    expect(registry.list()).toHaveLength(1);

    await registry.deregister("organ-2");
    expect(registry.list()).toHaveLength(0);
    expect(registry.get("organ-2")).toBeUndefined();
  });

  it("calls a tool through the registry", async () => {
    const connector = new MockConnector(makeConfig("organ-3"), [toolA]);
    await registry.register(connector);

    const result = await registry.callTool("tool-a", {});
    expect(result).toEqual({ result: "mock" });
  });

  it("throws on unknown tool", async () => {
    await expect(registry.callTool("no-such-tool", {})).rejects.toThrow(
      /no-such-tool/,
    );
  });

  it("aggregates tools from all organs", async () => {
    const c1 = new MockConnector(makeConfig("organ-4"), [toolA]);
    const c2 = new MockConnector(makeConfig("organ-5"), [toolB]);
    await registry.register(c1);
    await registry.register(c2);

    const tools = registry.allTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain("tool-a");
    expect(names).toContain("tool-b");
  });

  it("healthCheckAll returns statuses for all organs", async () => {
    const c1 = new MockConnector(makeConfig("organ-6"), [toolA]);
    const c2 = new MockConnector(makeConfig("organ-7"), [toolB]);
    await registry.register(c1);
    await registry.register(c2);

    const results = await registry.healthCheckAll();
    expect(results.size).toBe(2);
    expect(results.get("organ-6")).toBe("healthy");
    expect(results.get("organ-7")).toBe("healthy");
  });
});
