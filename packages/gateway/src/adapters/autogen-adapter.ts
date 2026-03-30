// ---------------------------------------------------------------------------
// AutoGen Adapter — translates AutoGen multi-agent messages to StemPipeline
// ---------------------------------------------------------------------------

import { Router } from "express";
import type { StemPipeline } from "../pipeline.js";
import type { FrameworkAdapter } from "./base-adapter.js";

interface AutoGenRequest {
  sender: string;
  recipient?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface AutoGenResponse {
  sender: string;
  recipient: string;
  message: unknown;
  metadata: Record<string, unknown>;
}

export class AutoGenAdapter implements FrameworkAdapter {
  readonly name = "autogen";
  readonly prefix = "/adapters/autogen";

  createRouter(pipeline: StemPipeline): Router {
    const router = Router();

    router.post("/chat", async (req, res, next) => {
      try {
        const body = req.body as AutoGenRequest;
        const { sender, message, metadata = {} } = body;

        const pipelineResponse = await pipeline.process({
          callerId: sender ?? "autogen-client",
          message: message ?? "",
        });

        const response: AutoGenResponse = {
          sender: "stem",
          recipient: sender ?? "autogen-client",
          message: pipelineResponse.result,
          metadata: {
            ...metadata,
            routing: pipelineResponse.routing,
            skillMatched: pipelineResponse.skillMatched,
            durationMs: pipelineResponse.durationMs,
          },
        };

        res.json(response);
      } catch (err) {
        next(err);
      }
    });

    return router;
  }
}
