import { Router } from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";

export function agUiRouter(registry: OrganRegistry): Router {
  const router = Router();

  // SSE endpoint for streaming pipeline events
  router.get("/ag-ui/stream", (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",  // Disable nginx buffering
    });

    // Send initial connection event
    sendEvent(res, "RUN_STARTED", {
      timestamp: new Date().toISOString(),
      organs: registry.list().map(o => ({ name: o.name, status: o.status })),
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);

    // Clean up on close
    req.on("close", () => {
      clearInterval(heartbeat);
    });
  });

  // POST endpoint to submit a task and stream results
  router.post("/ag-ui/run", async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const { message, callerId } = req.body;

    try {
      // Stream pipeline stages
      sendEvent(res, "RUN_STARTED", { timestamp: new Date().toISOString() });

      sendEvent(res, "REASONING_MESSAGE", {
        content: `Analyzing task: "${message?.slice(0, 100)}"`,
      });

      // List available tools
      const tools = registry.allTools();
      sendEvent(res, "STATE_SNAPSHOT", {
        organs: registry.list().length,
        tools: tools.length,
        callerId: callerId ?? "anonymous",
      });

      // If tools are available, show routing decision
      if (tools.length > 0) {
        sendEvent(res, "TOOL_CALL_START", {
          toolName: tools[0].name,
          organ: tools[0].organ,
        });

        try {
          const result = await registry.callTool(tools[0].name, { task: message });
          sendEvent(res, "TOOL_CALL_END", { result });
        } catch (err) {
          sendEvent(res, "TOOL_CALL_END", { error: (err as Error).message });
        }
      }

      sendEvent(res, "TEXT_MESSAGE_START", {});
      sendEvent(res, "TEXT_MESSAGE_CONTENT", {
        content: `Processed with ${tools.length} tools across ${registry.list().length} organs`
      });
      sendEvent(res, "TEXT_MESSAGE_END", {});

      sendEvent(res, "RUN_FINISHED", {
        timestamp: new Date().toISOString(),
        durationMs: 0,  // TODO: actual timing
      });
    } catch (err) {
      sendEvent(res, "RUN_ERROR", { error: (err as Error).message });
    }

    res.end();
  });

  return router;
}

function sendEvent(res: any, type: string, data: unknown): void {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
