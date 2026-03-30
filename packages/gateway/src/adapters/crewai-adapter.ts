// ---------------------------------------------------------------------------
// CrewAI Adapter — translates CrewAI task delegation to StemPipeline
// ---------------------------------------------------------------------------

import { Router } from "express";
import type { StemPipeline } from "../pipeline.js";
import type { FrameworkAdapter } from "./base-adapter.js";

interface CrewAITask {
  description: string;
  expected_output?: string;
}

interface CrewAIAgent {
  role: string;
  goal?: string;
}

interface CrewAIRequest {
  task: CrewAITask;
  agent: CrewAIAgent;
  context?: string;
}

interface CrewAIResponse {
  output: unknown;
  task: CrewAITask;
  agent: CrewAIAgent;
  metadata: {
    routing: { architecture: string; primaryOrgan: string };
    skillMatched: string | null;
    durationMs: number;
  };
}

export class CrewAIAdapter implements FrameworkAdapter {
  readonly name = "crewai";
  readonly prefix = "/adapters/crewai";

  createRouter(pipeline: StemPipeline): Router {
    const router = Router();

    router.post("/task", async (req, res, next) => {
      try {
        const body = req.body as CrewAIRequest;
        const { task, agent, context } = body;

        // Compose message from task description and optional context
        const message = context
          ? `${task.description}\n\nContext: ${context}`
          : task.description;

        const pipelineResponse = await pipeline.process({
          callerId: `crewai:${agent?.role ?? "agent"}`,
          message: message ?? "",
        });

        const response: CrewAIResponse = {
          output: pipelineResponse.result,
          task,
          agent,
          metadata: {
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
