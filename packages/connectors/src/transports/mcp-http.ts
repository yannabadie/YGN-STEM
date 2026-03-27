import type { ToolDescriptor } from "@ygn-stem/shared";
import { JsonRpcResponseSchema } from "@ygn-stem/shared";

export interface McpHttpTransportOptions {
  /** Full URL to the MCP endpoint, e.g. "http://localhost:8001/mcp" */
  url: string;
  /** Request timeout in milliseconds. Default: 30 000 */
  timeoutMs?: number;
  /** Additional HTTP request headers */
  headers?: Record<string, string>;
  /**
   * Organ name used to prefix tool names, e.g. "sage".
   * When supplied the tool `echo` becomes `sage.echo`.
   */
  organ?: string;
}

interface McpInitializeResult {
  protocolVersion: string;
  serverInfo: { name: string };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Counter that produces monotonically increasing JSON-RPC ids. */
let _idCounter = 1;
function nextId(): number {
  return _idCounter++;
}

// ---------------------------------------------------------------------------
// McpHttpTransport
// ---------------------------------------------------------------------------

/**
 * A real MCP client that speaks JSON-RPC 2.0 over HTTP (Streamable HTTP
 * transport as defined in the MCP 2024-11-05 spec).
 *
 * Each call is a standalone HTTP POST so no persistent connection is required.
 * The `initialize` / `notifications/initialized` handshake must be completed
 * before `listTools` or `callTool` are used.
 */
export class McpHttpTransport {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;
  private readonly organ: string;

  private _initialized = false;

  constructor(options: McpHttpTransportOptions) {
    this.url = options.url;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.headers = options.headers ?? {};
    this.organ = options.organ ?? "";
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Perform the MCP initialize handshake.
   * Sends `initialize` and then the `notifications/initialized` notification.
   */
  async initialize(): Promise<McpInitializeResult> {
    const result = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "ygn-stem", version: "0.1.0" },
    });

    // Parse result loosely — MCP servers vary in strictness
    const data = result as { protocolVersion?: unknown; serverInfo?: unknown };
    const initResult: McpInitializeResult = {
      protocolVersion: String(data.protocolVersion ?? ""),
      serverInfo: { name: String((data.serverInfo as { name?: string } | undefined)?.name ?? "") },
    };

    // Send the required initialized notification (no id → expect 204)
    await this._sendNotification("notifications/initialized");

    this._initialized = true;
    return initResult;
  }

  /** Returns the list of tools exposed by the remote MCP server. */
  async listTools(): Promise<ToolDescriptor[]> {
    this._assertInitialized();

    const result = await this.sendRequest("tools/list");
    const data = result as { tools?: unknown[] };
    const rawTools = Array.isArray(data.tools) ? data.tools : [];

    return rawTools.map((t) => this._mcpToolToDescriptor(t as McpTool));
  }

  /** Invoke a named tool on the remote MCP server. */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this._assertInitialized();

    // Strip organ prefix if present before forwarding to the server
    const rawName = this.organ && name.startsWith(`${this.organ}.`)
      ? name.slice(this.organ.length + 1)
      : name;

    const result = await this.sendRequest("tools/call", {
      name: rawName,
      arguments: args,
    });

    const data = result as { content?: unknown[] };
    return Array.isArray(data.content) ? data.content : data;
  }

  /**
   * Send a raw JSON-RPC 2.0 request and return the `result` field.
   * Throws if the server returns a JSON-RPC error or a non-2xx HTTP status.
   */
  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const id = nextId();
    const body: Record<string, unknown> = { jsonrpc: "2.0", method, id };
    if (params !== undefined) {
      body.params = params;
    }

    const response = await this._fetch(body);

    if (!response.ok) {
      throw new McpTransportError(
        `HTTP ${response.status} ${response.statusText} from ${this.url} (method=${method})`,
        response.status,
      );
    }

    const json: unknown = await response.json();
    const parsed = JsonRpcResponseSchema.safeParse(json);

    if (!parsed.success) {
      throw new McpTransportError(
        `Invalid JSON-RPC response from ${this.url}: ${parsed.error.message}`,
      );
    }

    if (parsed.data.error) {
      throw new McpRpcError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.data,
      );
    }

    return parsed.data.result;
  }

  /** Close (no-op for HTTP — nothing to teardown). */
  async close(): Promise<void> {
    this._initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _assertInitialized(): void {
    if (!this._initialized) {
      throw new McpTransportError(
        "McpHttpTransport: call initialize() before using listTools() or callTool()",
      );
    }
  }

  /**
   * Send a JSON-RPC notification (no `id` field).
   * Per the MCP spec, the server should respond with 204 No Content.
   */
  private async _sendNotification(method: string, params?: unknown): Promise<void> {
    const body: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (params !== undefined) {
      body.params = params;
    }

    const response = await this._fetch(body);

    // Accept 200 as well — some servers return 200 with an empty body
    if (response.status !== 204 && !response.ok) {
      throw new McpTransportError(
        `Unexpected HTTP ${response.status} for notification '${method}'`,
        response.status,
      );
    }
  }

  private async _fetch(body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, */*",
          ...this.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new McpTransportError(
          `Request to ${this.url} timed out after ${this.timeoutMs}ms`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private _mcpToolToDescriptor(tool: McpTool): ToolDescriptor {
    const prefixed = this.organ ? `${this.organ}.${tool.name}` : tool.name;
    return {
      name: prefixed,
      description: tool.description ?? "",
      inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {},
    };
  }
}

// ---------------------------------------------------------------------------
// Internal MCP type
// ---------------------------------------------------------------------------

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Thrown for transport-level failures (timeout, bad HTTP status, malformed response). */
export class McpTransportError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "McpTransportError";
  }
}

/** Thrown when the server returns a JSON-RPC `error` object. */
export class McpRpcError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "McpRpcError";
  }
}
