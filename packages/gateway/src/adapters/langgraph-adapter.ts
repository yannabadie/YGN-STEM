// ---------------------------------------------------------------------------
// LangGraph Adapter — translates LangGraph state-based invocations to StemPipeline
// ---------------------------------------------------------------------------

import { Router } from "express";
import type { StemPipeline } from "../pipeline.js";
import type { FrameworkAdapter } from "./base-adapter.js";

interface LangGraphMessage {
  role: string;
  content: string;
}

interface LangGraphInput {
  messages: LangGraphMessage[];
}

interface LangGraphConfig {
  thread_id?: string;
  configurable?: Record<string, unknown>;
}

interface LangGraphRequest {
  input: LangGraphInput;
  config?: LangGraphConfig;
}

interface LangGraphResponse {
  output: {
    messages: LangGraphMessage[];
  };
}

export class LangGraphAdapter implements FrameworkAdapter {
  readonly name = "langgraph";
  readonly prefix = "/adapters/langgraph";

  createRouter(pipeline: StemPipeline): Router {
    const router = Router();

    router.post("/invoke", async (req, res, next) => {
      try {
        const body = req.body as LangGraphRequest;
        const { input, config = {} } = body;
        const threadId = config.thread_id ?? "default";

        // Extract last message content from the messages array
        const messages: LangGraphMessage[] = input?.messages ?? [];
        const lastMessage = messages.at(-1);
        const messageContent = lastMessage?.content ?? "";

        const pipelineResponse = await pipeline.process({
          callerId: `langgraph:${threadId}`,
          message: messageContent,
        });

        // Append assistant response to original messages
        const assistantMessage: LangGraphMessage = {
          role: "assistant",
          content:
            typeof pipelineResponse.result === "string"
              ? pipelineResponse.result
              : JSON.stringify(pipelineResponse.result),
        };

        const response: LangGraphResponse = {
          output: {
            messages: [...messages, assistantMessage],
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
