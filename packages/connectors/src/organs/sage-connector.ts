import { BaseConnector } from "../base-connector.js";
import { McpHttpTransport } from "../transports/mcp-http.js";
import type { OrganConfig, OrganInfo, OrganStatus, ToolDescriptor } from "@ygn-stem/shared";

/**
 * Connects to YGN-SAGE via MCP Streamable HTTP.
 *
 * SAGE is the knowledge / reasoning organ — it exposes tools such as
 * `sage.query`, `sage.reason`, etc.
 */
export class SageConnector extends BaseConnector {
  private transport: McpHttpTransport | null = null;
  private serverVersion = "unknown";

  constructor(config?: Partial<OrganConfig>) {
    super({
      organId: config?.organId ?? "sage",
      transport: config?.transport ?? "http",
      endpoint: config?.endpoint ?? "http://localhost:8001/mcp",
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
    this.serverVersion = init.serverInfo.name || "sage";
  }

  protected async doDisconnect(): Promise<void> {
    await this.transport?.close();
    this.transport = null;
  }

  protected async doCallTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.transport) throw new Error("SageConnector: not connected");
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
      name: "YGN-SAGE",
      status: this.status,
      transport: this.config.transport,
      version: this.serverVersion,
      capabilities: ["knowledge-retrieval", "reasoning", "mcp"],
    };
  }
}
