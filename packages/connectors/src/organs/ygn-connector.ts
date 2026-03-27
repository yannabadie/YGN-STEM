import { BaseConnector } from "../base-connector.js";
import { McpHttpTransport } from "../transports/mcp-http.js";
import type { OrganConfig, OrganInfo, OrganStatus, ToolDescriptor } from "@ygn-stem/shared";

/**
 * Connects to Y-GN (the primary brain organ) via MCP Streamable HTTP.
 *
 * Y-GN orchestrates multi-step tasks and exposes tools such as
 * `ygn.orchestrate`, `ygn.run_task`, etc.
 */
export class YgnConnector extends BaseConnector {
  private transport: McpHttpTransport | null = null;
  private serverVersion = "unknown";

  constructor(config?: Partial<OrganConfig>) {
    super({
      organId: config?.organId ?? "ygn",
      transport: config?.transport ?? "http",
      endpoint: config?.endpoint ?? "http://localhost:3000/mcp",
      timeoutMs: config?.timeoutMs ?? 30_000,
      ...config,
    });
  }

  protected async doConnect(): Promise<void> {
    this.transport = new McpHttpTransport({
      url: this.config.endpoint,
      organ: this.config.organId,
      timeoutMs: this.config.timeoutMs,
      headers: this.config.headers,
    });
    const init = await this.transport.initialize();
    this.serverVersion = init.serverInfo.name || "y-gn";
  }

  protected async doDisconnect(): Promise<void> {
    await this.transport?.close();
    this.transport = null;
  }

  protected async doCallTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.transport) throw new Error("YgnConnector: not connected");
    return this.transport.callTool(name, args);
  }

  protected async doHealth(): Promise<OrganStatus> {
    try {
      if (!this.transport) return "unavailable";
      await this.transport.sendRequest("ping");
      return "healthy";
    } catch {
      return "degraded";
    }
  }

  protected async doListTools(): Promise<ToolDescriptor[]> {
    if (!this.transport) return [];
    return this.transport.listTools();
  }

  protected async doInfo(): Promise<OrganInfo> {
    return {
      organId: this.config.organId,
      name: "Y-GN",
      status: this.status,
      transport: this.config.transport,
      version: this.serverVersion,
      capabilities: ["orchestration", "task-execution", "mcp"],
    };
  }
}
