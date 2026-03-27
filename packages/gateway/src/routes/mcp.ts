import { Router } from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";
import { JsonRpcRequestSchema } from "@ygn-stem/shared";

// JSON-RPC 2.0 error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

function jsonRpcSuccess(id: string | number, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

export function createMcpRouter(registry: OrganRegistry): Router {
  const router = Router();

  router.post("/mcp", async (req, res) => {
    const body: unknown = req.body;

    // Validate JSON-RPC envelope
    const parsed = JsonRpcRequestSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json(
        jsonRpcError(null, INVALID_REQUEST, "Invalid JSON-RPC request"),
      );
      return;
    }

    const { id, method, params } = parsed.data;

    try {
      if (method === "tools/list") {
        const tools = registry.allTools();
        res.json(jsonRpcSuccess(id, { tools }));
        return;
      }

      if (method === "tools/call") {
        const callParams = params as Record<string, unknown> | undefined;
        const toolName = callParams?.["name"];
        const toolArgs = (callParams?.["arguments"] ?? {}) as Record<string, unknown>;

        if (typeof toolName !== "string" || toolName.length === 0) {
          res.status(400).json(
            jsonRpcError(id, INVALID_REQUEST, "Missing required param: name"),
          );
          return;
        }

        try {
          const result = await registry.callTool(toolName, toolArgs);
          res.json(jsonRpcSuccess(id, result));
        } catch (toolErr: unknown) {
          const msg =
            toolErr instanceof Error
              ? toolErr.message
              : "Tool call failed";
          res.status(200).json(
            jsonRpcError(id, INTERNAL_ERROR, msg),
          );
        }
        return;
      }

      // Unknown method
      res.status(200).json(
        jsonRpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Internal error";
      res.status(500).json(jsonRpcError(id, INTERNAL_ERROR, msg));
    }
  });

  // Handle malformed JSON body (Express 5 passes SyntaxError to error middleware,
  // but we also want to catch it at route level for proper JSON-RPC response)
  router.use(
    "/mcp",
    (
      err: Error & { type?: string },
      _req: import("express").Request,
      res: import("express").Response,
      _next: import("express").NextFunction,
    ) => {
      if (err.type === "entity.parse.failed") {
        res.status(400).json(jsonRpcError(null, PARSE_ERROR, "Parse error"));
        return;
      }
      res.status(500).json(jsonRpcError(null, INTERNAL_ERROR, err.message));
    },
  );

  return router;
}
