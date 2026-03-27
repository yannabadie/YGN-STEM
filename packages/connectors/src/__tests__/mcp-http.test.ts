import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { McpHttpTransport, McpTransportError, McpRpcError } from "../transports/mcp-http.js";

// ---------------------------------------------------------------------------
// Minimal mock MCP server backed by Node's built-in http module
// ---------------------------------------------------------------------------

function createMockMcpServer(): Server {
  return createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer | string) => {
      body += String(chunk);
    });
    req.on("end", () => {
      let rpc: Record<string, unknown>;
      try {
        rpc = JSON.parse(body) as Record<string, unknown>;
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }

      const method = rpc.method as string;
      const id = rpc.id;

      if (method === "initialize") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              protocolVersion: "2024-11-05",
              serverInfo: { name: "mock-server" },
            },
            id,
          }),
        );
      } else if (method === "notifications/initialized") {
        res.writeHead(204);
        res.end();
      } else if (method === "tools/list") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              tools: [
                {
                  name: "echo",
                  description: "Echo input",
                  inputSchema: { type: "object", properties: { text: { type: "string" } } },
                },
              ],
            },
            id,
          }),
        );
      } else if (method === "tools/call") {
        const params = rpc.params as { arguments?: unknown };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify(params.arguments) }],
            },
            id,
          }),
        );
      } else if (method === "rpc_error_test") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method not found" },
            id,
          }),
        );
      } else if (method === "http_error_test") {
        res.writeHead(500);
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("McpHttpTransport", () => {
  let server: Server;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    server = createMockMcpServer();
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Could not get server address");
    port = addr.port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(() => {
    server.close();
  });

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------

  it("initialize() connects and returns server info", async () => {
    const transport = new McpHttpTransport({ url: baseUrl, organ: "sage" });
    const result = await transport.initialize();

    expect(result.protocolVersion).toBe("2024-11-05");
    expect(result.serverInfo.name).toBe("mock-server");

    await transport.close();
  });

  // -------------------------------------------------------------------------
  // listTools
  // -------------------------------------------------------------------------

  it("listTools() returns tool descriptors with organ prefix", async () => {
    const transport = new McpHttpTransport({ url: baseUrl, organ: "sage" });
    await transport.initialize();
    const tools = await transport.listTools();

    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("sage.echo");
    expect(tools[0]!.description).toBe("Echo input");
    expect(tools[0]!.inputSchema).toMatchObject({ type: "object" });

    await transport.close();
  });

  it("listTools() with no organ prefix leaves name unchanged", async () => {
    const transport = new McpHttpTransport({ url: baseUrl });
    await transport.initialize();
    const tools = await transport.listTools();

    expect(tools[0]!.name).toBe("echo");
    await transport.close();
  });

  // -------------------------------------------------------------------------
  // callTool
  // -------------------------------------------------------------------------

  it("callTool() sends arguments and returns content array", async () => {
    const transport = new McpHttpTransport({ url: baseUrl, organ: "sage" });
    await transport.initialize();

    const result = await transport.callTool("sage.echo", { text: "hello" });

    expect(Array.isArray(result)).toBe(true);
    const content = result as Array<{ type: string; text: string }>;
    expect(content[0]!.type).toBe("text");
    expect(JSON.parse(content[0]!.text)).toEqual({ text: "hello" });

    await transport.close();
  });

  it("callTool() without prefix also works", async () => {
    const transport = new McpHttpTransport({ url: baseUrl, organ: "sage" });
    await transport.initialize();

    const result = await transport.callTool("echo", { text: "world" });
    const content = result as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0]!.text)).toEqual({ text: "world" });

    await transport.close();
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it("throws McpRpcError when server returns a JSON-RPC error", async () => {
    const transport = new McpHttpTransport({ url: baseUrl, organ: "sage" });
    await transport.initialize();

    await expect(transport.sendRequest("rpc_error_test")).rejects.toThrow(McpRpcError);
    await expect(transport.sendRequest("rpc_error_test")).rejects.toMatchObject({
      code: -32601,
      message: "Method not found",
    });

    await transport.close();
  });

  it("throws McpTransportError on non-2xx HTTP status", async () => {
    const transport = new McpHttpTransport({ url: baseUrl, organ: "sage" });
    await transport.initialize();

    await expect(transport.sendRequest("http_error_test")).rejects.toThrow(McpTransportError);
    await expect(transport.sendRequest("http_error_test")).rejects.toMatchObject({
      statusCode: 500,
    });

    await transport.close();
  });

  it("throws McpTransportError on timeout", async () => {
    // Create a server that never responds
    const hangingServer = createServer((_req, _res) => {
      // intentionally hang — never call res.end()
    });
    await new Promise<void>((resolve) => hangingServer.listen(0, () => resolve()));
    const hangAddr = hangingServer.address();
    const hangPort = typeof hangAddr === "object" && hangAddr ? hangAddr.port : 0;

    const transport = new McpHttpTransport({
      url: `http://localhost:${hangPort}`,
      timeoutMs: 100,
    });

    await expect(transport.sendRequest("initialize")).rejects.toThrow(/timed out/i);

    hangingServer.close();
  });

  it("throws McpTransportError when connecting to a non-existent server", async () => {
    const transport = new McpHttpTransport({
      url: "http://localhost:1", // port 1 is almost certainly unused
      timeoutMs: 5000,
    });

    await expect(transport.sendRequest("initialize")).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Guard: must call initialize() first
  // -------------------------------------------------------------------------

  it("throws if listTools() is called before initialize()", async () => {
    const transport = new McpHttpTransport({ url: baseUrl });
    await expect(transport.listTools()).rejects.toThrow(/initialize/i);
  });

  it("throws if callTool() is called before initialize()", async () => {
    const transport = new McpHttpTransport({ url: baseUrl });
    await expect(transport.callTool("echo", {})).rejects.toThrow(/initialize/i);
  });

  // -------------------------------------------------------------------------
  // Extra headers
  // -------------------------------------------------------------------------

  it("sends extra headers to the server", async () => {
    let seenAuth: string | undefined;

    const headerServer = createServer((req, res) => {
      seenAuth = req.headers["x-api-key"] as string | undefined;
      let body = "";
      req.on("data", (c: Buffer | string) => (body += String(c)));
      req.on("end", () => {
        const rpc = JSON.parse(body) as { method: string; id: unknown };
        if (rpc.method === "initialize") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              result: { protocolVersion: "2024-11-05", serverInfo: { name: "header-test" } },
              id: rpc.id,
            }),
          );
        } else {
          res.writeHead(204);
          res.end();
        }
      });
    });
    await new Promise<void>((resolve) => headerServer.listen(0, () => resolve()));
    const hAddr = headerServer.address();
    const hPort = typeof hAddr === "object" && hAddr ? hAddr.port : 0;

    const transport = new McpHttpTransport({
      url: `http://localhost:${hPort}`,
      headers: { "x-api-key": "secret-token" },
    });
    await transport.initialize();

    expect(seenAuth).toBe("secret-token");

    await transport.close();
    headerServer.close();
  });
});
