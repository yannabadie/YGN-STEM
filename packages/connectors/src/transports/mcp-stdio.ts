import { spawn, type ChildProcess } from "node:child_process";
import type { ToolDescriptor } from "@ygn-stem/shared";
import { JsonRpcResponseSchema } from "@ygn-stem/shared";
import { McpRpcError, McpTransportError } from "./mcp-http.js";

export interface McpStdioTransportOptions {
  /** Executable to spawn, e.g. "ygn-core" */
  command: string;
  /** Arguments passed to the command, e.g. ["mcp"] */
  args: string[];
  /** Working directory for the subprocess */
  cwd?: string;
  /** Extra environment variables merged with process.env */
  env?: Record<string, string>;
  /** Request timeout in milliseconds. Default: 30 000 */
  timeoutMs?: number;
  /**
   * Organ name used to prefix tool names, e.g. "y-gn".
   * When supplied the tool `echo` becomes `y-gn.echo`.
   */
  organ?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// McpStdioTransport
// ---------------------------------------------------------------------------

/**
 * MCP client over stdio.
 *
 * Spawns a subprocess and exchanges newline-delimited JSON-RPC 2.0 messages
 * via stdin/stdout.  Each in-flight request is tracked by its JSON-RPC `id`;
 * the response line is matched and the corresponding Promise is resolved.
 */
export class McpStdioTransport {
  private readonly timeoutMs: number;
  private readonly organ: string;

  private _process: ChildProcess | null = null;
  private _initialized = false;
  private _buffer = "";
  private readonly _pending = new Map<number | string, PendingRequest>();

  private static _idCounter = 1;

  constructor(private readonly options: McpStdioTransportOptions) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.organ = options.organ ?? "";
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Spawn the process and perform the MCP initialize handshake. */
  async initialize(): Promise<{ protocolVersion: string; serverInfo: { name: string } }> {
    this._spawnProcess();

    const result = await this._sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "ygn-stem", version: "0.1.0" },
    });

    const data = result as { protocolVersion?: unknown; serverInfo?: unknown };
    const initResult = {
      protocolVersion: String(data.protocolVersion ?? ""),
      serverInfo: { name: String((data.serverInfo as { name?: string } | undefined)?.name ?? "") },
    };

    // Notifications have no id — fire-and-forget over stdin
    this._sendRawLine({ jsonrpc: "2.0", method: "notifications/initialized" });

    this._initialized = true;
    return initResult;
  }

  async listTools(): Promise<ToolDescriptor[]> {
    this._assertInitialized();

    const result = await this._sendRequest("tools/list");
    const data = result as { tools?: unknown[] };
    const rawTools = Array.isArray(data.tools) ? data.tools : [];

    return rawTools.map((t) => this._mcpToolToDescriptor(t as McpTool));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    this._assertInitialized();

    const rawName =
      this.organ && name.startsWith(`${this.organ}.`)
        ? name.slice(this.organ.length + 1)
        : name;

    const result = await this._sendRequest("tools/call", {
      name: rawName,
      arguments: args,
    });

    const data = result as { content?: unknown[] };
    return Array.isArray(data.content) ? data.content : data;
  }

  /** Terminate the subprocess and reject all pending requests. */
  async close(): Promise<void> {
    this._initialized = false;

    // Reject everything in-flight
    for (const [id, pending] of this._pending) {
      clearTimeout(pending.timer);
      pending.reject(new McpTransportError(`McpStdioTransport closed while request ${id} was in-flight`));
    }
    this._pending.clear();

    if (this._process) {
      this._process.kill();
      this._process = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _assertInitialized(): void {
    if (!this._initialized) {
      throw new McpTransportError(
        "McpStdioTransport: call initialize() before using listTools() or callTool()",
      );
    }
  }

  private _spawnProcess(): void {
    if (this._process) return;

    const { command, args, cwd, env } = this.options;

    this._process = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this._process.stderr?.on("data", (chunk: Buffer) => {
      // Stderr from the subprocess is discarded (or could be forwarded to a
      // logger in the future).  We don't throw here because many MCP servers
      // print diagnostics to stderr.
      void chunk;
    });

    this._process.stdout?.setEncoding("utf8");
    this._process.stdout?.on("data", (chunk: string) => {
      this._handleChunk(chunk);
    });

    this._process.on("error", (err) => {
      this._rejectAll(new McpTransportError(`Subprocess error: ${err.message}`));
    });

    this._process.on("exit", (code) => {
      if (this._pending.size > 0) {
        this._rejectAll(
          new McpTransportError(`Subprocess exited with code ${code} while requests were pending`),
        );
      }
      this._process = null;
    });
  }

  /** Accumulate data and parse complete newline-delimited JSON lines. */
  private _handleChunk(chunk: string): void {
    this._buffer += chunk;
    let newline: number;
    while ((newline = this._buffer.indexOf("\n")) !== -1) {
      const line = this._buffer.slice(0, newline).trim();
      this._buffer = this._buffer.slice(newline + 1);
      if (line.length > 0) {
        this._handleLine(line);
      }
    }
  }

  private _handleLine(line: string): void {
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      // Ignore non-JSON lines (e.g. subprocess startup messages)
      return;
    }

    const parsed = JsonRpcResponseSchema.safeParse(json);
    if (!parsed.success) return;

    const { id, result, error } = parsed.data;
    if (id === null || id === undefined) return;

    const pending = this._pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this._pending.delete(id);

    if (error) {
      pending.reject(new McpRpcError(error.message, error.code, error.data));
    } else {
      pending.resolve(result);
    }
  }

  private _sendRequest(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = McpStdioTransport._idCounter++;
      const body: Record<string, unknown> = { jsonrpc: "2.0", method, id };
      if (params !== undefined) {
        body.params = params;
      }

      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(
          new McpTransportError(`Request '${method}' timed out after ${this.timeoutMs}ms`),
        );
      }, this.timeoutMs);

      this._pending.set(id, { resolve, reject, timer });
      this._sendRawLine(body);
    });
  }

  private _sendRawLine(obj: unknown): void {
    if (!this._process?.stdin) {
      throw new McpTransportError("McpStdioTransport: subprocess stdin is not available");
    }
    this._process.stdin.write(JSON.stringify(obj) + "\n");
  }

  private _rejectAll(err: Error): void {
    for (const [, pending] of this._pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this._pending.clear();
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
