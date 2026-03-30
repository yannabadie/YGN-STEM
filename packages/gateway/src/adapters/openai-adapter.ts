// ---------------------------------------------------------------------------
// OpenAI Adapter — translates OpenAI Agents SDK chat completions to StemPipeline
// ---------------------------------------------------------------------------

import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { StemPipeline } from "../pipeline.js";
import type { FrameworkAdapter } from "./base-adapter.js";

interface OpenAIMessage {
  role: string;
  content: string;
}

interface OpenAIRequest {
  model?: string;
  messages: OpenAIMessage[];
  tools?: unknown[];
  stream?: boolean;
}

interface OpenAIChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIAdapter implements FrameworkAdapter {
  readonly name = "openai";
  readonly prefix = "/adapters/openai";

  createRouter(pipeline: StemPipeline): Router {
    const router = Router();

    router.post("/chat/completions", async (req, res, next) => {
      try {
        const body = req.body as OpenAIRequest;
        const { messages = [], model = "ygn-stem" } = body;

        // Derive callerId from auth header (Bearer token) or API key header, or default
        const authHeader = req.headers["authorization"] as string | undefined;
        const apiKeyHeader =
          (req.headers["x-api-key"] as string | undefined) ??
          (req.headers["x-caller-id"] as string | undefined);
        let callerId = "openai-client";
        if (apiKeyHeader) {
          callerId = apiKeyHeader;
        } else if (authHeader?.startsWith("Bearer ")) {
          callerId = authHeader.slice(7);
        }

        // Extract last user message
        const lastUserMessage = [...messages]
          .reverse()
          .find((m) => m.role === "user");
        const messageContent = lastUserMessage?.content ?? "";

        const pipelineResponse = await pipeline.process({
          callerId,
          message: messageContent,
        });

        const resultContent =
          typeof pipelineResponse.result === "string"
            ? pipelineResponse.result
            : JSON.stringify(pipelineResponse.result);

        const response: OpenAIResponse = {
          id: `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 24)}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: resultContent,
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: messageContent.length,
            completion_tokens: resultContent.length,
            total_tokens: messageContent.length + resultContent.length,
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
