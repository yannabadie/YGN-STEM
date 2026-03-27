import express from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";
import type { HindsightMemory } from "@ygn-stem/memory";
import type { CallerProfiler, ArchitectureSelector, SkillsEngine } from "@ygn-stem/adaptive";
import { requestId } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createHealthRouter } from "./routes/health.js";
import { createA2ARouter } from "./routes/a2a.js";
import { createMcpRouter } from "./routes/mcp.js";
import { StemPipeline, type PipelineRequest } from "./pipeline.js";
import { createAuthMiddleware, type AuthOptions } from "./middleware/auth.js";

export interface GatewayOptions {
  registry: OrganRegistry;
  /** Optional: provide all pipeline dependencies to enable POST /api/process */
  memory?: HindsightMemory;
  profiler?: CallerProfiler;
  selector?: ArchitectureSelector;
  skills?: SkillsEngine;
  /** Optional: authentication configuration (JWT + API Key) */
  auth?: AuthOptions;
}

export function createGateway(options: GatewayOptions): express.Express {
  const { registry } = options;
  const app = express();

  // Body parsing
  app.use(express.json());

  // Correlation ID on every request
  app.use(requestId);

  // Auth middleware (after requestId, before routes)
  if (options.auth) {
    app.use(createAuthMiddleware(options.auth));
  }

  // Route handlers
  app.use(createHealthRouter(registry));
  app.use(createA2ARouter(registry));
  app.use(createMcpRouter(registry));

  // Pipeline route — only available when all pipeline dependencies are provided
  if (options.memory && options.profiler && options.selector && options.skills) {
    const pipeline = new StemPipeline({
      registry,
      memory: options.memory,
      profiler: options.profiler,
      selector: options.selector,
      skills: options.skills,
    });

    app.post("/api/process", async (req, res, next) => {
      try {
        const request: PipelineRequest = {
          callerId: (req.headers["x-caller-id"] as string) ?? "anonymous",
          message: req.body.message ?? "",
          toolName: req.body.toolName,
          toolArgs: req.body.toolArgs,
        };
        const response = await pipeline.process(request);
        res.json(response);
      } catch (err) {
        next(err);
      }
    });
  }

  // Global error handler (must be last, 4-arg signature)
  app.use(errorHandler);

  return app;
}
