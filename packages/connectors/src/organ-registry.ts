import type { OrganInfo, OrganStatus, ToolDescriptor } from "@ygn-stem/shared";
import type { BaseConnector } from "./base-connector.js";

interface OrganEntry {
  connector: BaseConnector;
  info: OrganInfo;
  tools: ToolDescriptor[];
}

export class OrganRegistry {
  private readonly organs = new Map<string, OrganEntry>();
  /** Maps tool name → organId for fast lookup */
  private readonly toolIndex = new Map<string, string>();

  async register(connector: BaseConnector): Promise<void> {
    await connector.connect();
    const info = await connector.info();
    const tools = [...connector.tools];

    this.organs.set(info.organId, { connector, info, tools });

    for (const tool of tools) {
      this.toolIndex.set(tool.name, info.organId);
    }
  }

  async deregister(organId: string): Promise<void> {
    const entry = this.organs.get(organId);
    if (!entry) return;

    // Remove tool index entries belonging to this organ
    for (const tool of entry.tools) {
      this.toolIndex.delete(tool.name);
    }

    await entry.connector.disconnect();
    this.organs.delete(organId);
  }

  get(organId: string): OrganEntry | undefined {
    return this.organs.get(organId);
  }

  list(): OrganInfo[] {
    return Array.from(this.organs.values()).map((e) => e.info);
  }

  allTools(): ToolDescriptor[] {
    return Array.from(this.organs.values()).flatMap((e) => e.tools);
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const organId = this.toolIndex.get(toolName);
    if (!organId) {
      throw new Error(`No organ found that provides tool '${toolName}'`);
    }
    const entry = this.organs.get(organId);
    if (!entry) {
      throw new Error(`Organ '${organId}' not found in registry`);
    }
    return entry.connector.callTool(toolName, args);
  }

  async healthCheckAll(): Promise<Map<string, OrganStatus>> {
    const results = new Map<string, OrganStatus>();
    await Promise.all(
      Array.from(this.organs.entries()).map(async ([organId, entry]) => {
        const status = await entry.connector.health();
        results.set(organId, status);
      }),
    );
    return results;
  }
}
