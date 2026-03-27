import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpStdioTransport, type McpStdioTransportOptions } from "../transports/mcp-stdio.js";

// ---------------------------------------------------------------------------
// A minimal MCP server implemented as an inline Node.js script.
// It reads newline-delimited JSON from stdin and writes responses to stdout.
// ---------------------------------------------------------------------------

const SERVER_SCRIPT = /* javascript */ `
process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;

    let rpc;
    try { rpc = JSON.parse(line); } catch { continue; }

    const { method, id, params } = rpc;

    // Notifications have no id — ack with nothing
    if (id === undefined || id === null) continue;

    if (method === 'initialize') {
      const resp = { jsonrpc: '2.0', result: { protocolVersion: '2024-11-05', serverInfo: { name: 'stdio-mock' } }, id };
      process.stdout.write(JSON.stringify(resp) + '\\n');
    } else if (method === 'tools/list') {
      const resp = { jsonrpc: '2.0', result: { tools: [{ name: 'ping', description: 'Ping tool', inputSchema: { type: 'object' } }] }, id };
      process.stdout.write(JSON.stringify(resp) + '\\n');
    } else if (method === 'tools/call') {
      const args = params && params.arguments ? params.arguments : {};
      const resp = { jsonrpc: '2.0', result: { content: [{ type: 'text', text: JSON.stringify(args) }] }, id };
      process.stdout.write(JSON.stringify(resp) + '\\n');
    } else if (method === 'rpc_error') {
      const resp = { jsonrpc: '2.0', error: { code: -32601, message: 'Not found' }, id };
      process.stdout.write(JSON.stringify(resp) + '\\n');
    } else {
      const resp = { jsonrpc: '2.0', error: { code: -32601, message: 'Unknown method: ' + method }, id };
      process.stdout.write(JSON.stringify(resp) + '\\n');
    }
  }
});
`;

// ---------------------------------------------------------------------------
// Setup — write the script to a temp file
// ---------------------------------------------------------------------------

let scriptPath: string;

beforeAll(() => {
  const dir = join(tmpdir(), "ygn-stem-test");
  mkdirSync(dir, { recursive: true });
  scriptPath = join(dir, "mock-mcp-server.mjs");
  writeFileSync(scriptPath, SERVER_SCRIPT, "utf8");
});

afterAll(() => {
  try {
    unlinkSync(scriptPath);
  } catch {
    // best-effort cleanup
  }
});

// ---------------------------------------------------------------------------
// Helper — build a default transport aimed at the mock script
// ---------------------------------------------------------------------------

function makeTransport(extra: Partial<McpStdioTransportOptions> = {}): McpStdioTransport {
  return new McpStdioTransport({
    command: process.execPath, // same `node` binary running the tests
    args: [scriptPath],
    timeoutMs: 10_000,
    organ: "mock",
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("McpStdioTransport", () => {
  const openTransports: McpStdioTransport[] = [];

  function track(t: McpStdioTransport): McpStdioTransport {
    openTransports.push(t);
    return t;
  }

  afterEach(async () => {
    // Ensure all transports are closed after each test
    await Promise.allSettled(openTransports.map((t) => t.close()));
    openTransports.length = 0;
  });

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------

  it("initialize() spawns the process and returns server info", async () => {
    const transport = track(makeTransport());
    const result = await transport.initialize();

    expect(result.protocolVersion).toBe("2024-11-05");
    expect(result.serverInfo.name).toBe("stdio-mock");
  });

  // -------------------------------------------------------------------------
  // listTools
  // -------------------------------------------------------------------------

  it("listTools() returns tool descriptors with organ prefix", async () => {
    const transport = track(makeTransport());
    await transport.initialize();

    const tools = await transport.listTools();

    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("mock.ping");
    expect(tools[0]!.description).toBe("Ping tool");
  });

  it("listTools() with no organ leaves name unchanged", async () => {
    const transport = track(makeTransport({ organ: undefined }));
    await transport.initialize();

    const tools = await transport.listTools();
    expect(tools[0]!.name).toBe("ping");
  });

  // -------------------------------------------------------------------------
  // callTool
  // -------------------------------------------------------------------------

  it("callTool() sends arguments and returns content", async () => {
    const transport = track(makeTransport());
    await transport.initialize();

    const result = await transport.callTool("mock.ping", { value: 42 });
    const content = result as Array<{ type: string; text: string }>;

    expect(Array.isArray(content)).toBe(true);
    expect(content[0]!.type).toBe("text");
    expect(JSON.parse(content[0]!.text)).toEqual({ value: 42 });
  });

  it("callTool() without organ prefix also works", async () => {
    const transport = track(makeTransport());
    await transport.initialize();

    const result = await transport.callTool("ping", { x: 1 });
    const content = result as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0]!.text)).toEqual({ x: 1 });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it("throws McpRpcError when server returns a JSON-RPC error", async () => {
    const { McpRpcError } = await import("../transports/mcp-http.js");

    const transport = track(makeTransport());
    await transport.initialize();

    // Access the private _sendRequest through callTool targeting a special path
    // — the server returns an error for 'rpc_error' method
    // We use a fresh McpStdioTransport where we skip the _initialized guard
    // by directly sending via the internal path; instead we can work around
    // by sending a method that produces a JSON-RPC error response.
    // The server returns an error for unknown methods:
    await expect(
      // callTool calls tools/call with name 'rpc_error', the server will return
      // "Unknown method" since tools/call is handled. We'll use a raw approach:
      // Actually test that an unknown tool name goes through tools/call and the
      // server echoes back args correctly, so let's test the rpc_error method
      // by crafting this differently.
      // The server script handles 'rpc_error' method specifically:
      // We need to bypass the _initialized check so we cast:
      (transport as unknown as { _sendRequest: (m: string) => Promise<unknown> })._sendRequest(
        "rpc_error",
      ),
    ).rejects.toThrow(McpRpcError);
  });

  // -------------------------------------------------------------------------
  // Guard: must call initialize() first
  // -------------------------------------------------------------------------

  it("throws if listTools() is called before initialize()", async () => {
    const transport = track(makeTransport());
    await expect(transport.listTools()).rejects.toThrow(/initialize/i);
  });

  it("throws if callTool() is called before initialize()", async () => {
    const transport = track(makeTransport());
    await expect(transport.callTool("ping", {})).rejects.toThrow(/initialize/i);
  });

  // -------------------------------------------------------------------------
  // close
  // -------------------------------------------------------------------------

  it("close() terminates the subprocess and resets state", async () => {
    const transport = track(makeTransport());
    await transport.initialize();
    await transport.close();

    // After close, listTools should throw because _initialized is reset
    await expect(transport.listTools()).rejects.toThrow(/initialize/i);
  });

  it("double-close() does not throw", async () => {
    const transport = track(makeTransport());
    await transport.initialize();
    await transport.close();
    await expect(transport.close()).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Bad command
  // -------------------------------------------------------------------------

  it("throws McpTransportError when the command does not exist", async () => {
    const transport = track(
      new McpStdioTransport({
        command: "this-command-definitely-does-not-exist-ygnstem",
        args: [],
        timeoutMs: 5_000,
      }),
    );

    // initialize() calls _spawnProcess which spawns the command, then
    // _sendRequest which times out or the process emits an error
    await expect(transport.initialize()).rejects.toThrow();
  });
});
