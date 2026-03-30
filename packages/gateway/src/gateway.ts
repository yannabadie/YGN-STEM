import express from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";
import type { HindsightMemory } from "@ygn-stem/memory";
import type { CallerProfiler, ArchitectureSelector, SkillsEngine } from "@ygn-stem/adaptive";
import type { UcpSessionStore, Ap2Store } from "@ygn-stem/commerce";
import { requestId } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createHealthRouter } from "./routes/health.js";
import { createA2ARouter } from "./routes/a2a.js";
import { createMcpRouter } from "./routes/mcp.js";
import { agUiRouter } from "./routes/ag-ui.js";
import { a2uiRouter } from "./routes/a2ui.js";
import { createUcpRouter } from "./routes/ucp.js";
import { createAp2Router } from "./routes/ap2.js";
import { StemPipeline, type PipelineRequest } from "./pipeline.js";
import { createAuthMiddleware, type AuthOptions } from "./middleware/auth.js";
import { createRateLimiter, type RateLimiterOptions } from "./middleware/rate-limiter.js";
import type { FrameworkAdapter } from "./adapters/base-adapter.js";

export interface GatewayOptions {
  registry: OrganRegistry;
  /** Optional: provide all pipeline dependencies to enable POST /api/process */
  memory?: HindsightMemory;
  profiler?: CallerProfiler;
  selector?: ArchitectureSelector;
  skills?: SkillsEngine;
  /** Optional: authentication configuration (JWT + API Key) */
  auth?: AuthOptions;
  /** Optional: token-bucket rate limiter per caller */
  rateLimiter?: RateLimiterOptions;
  /** Optional: UCP checkout session store — mounts /ucp routes when provided */
  ucpStore?: UcpSessionStore;
  /** Optional: AP2 payment store — mounts /ap2 routes when provided */
  ap2Store?: Ap2Store;
  /** Optional: framework adapters — mounted when pipeline dependencies are provided */
  adapters?: FrameworkAdapter[];
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

  // Rate limiter (after auth so callerId is available for per-caller buckets)
  if (options.rateLimiter !== undefined) {
    app.use(createRateLimiter(options.rateLimiter));
  }

  // Route handlers
  app.use(createHealthRouter(registry));
  app.use(createA2ARouter(registry));
  app.use(createMcpRouter(registry));
  app.use(agUiRouter(registry));
  app.use(a2uiRouter());

  // Commerce routes — mounted conditionally when stores are provided
  if (options.ucpStore !== undefined) {
    app.use(createUcpRouter(options.ucpStore));
  }
  if (options.ap2Store !== undefined) {
    app.use(createAp2Router(options.ap2Store));
  }

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

    // Framework adapters — mounted at their declared prefix
    if (options.adapters) {
      for (const adapter of options.adapters) {
        app.use(adapter.prefix, adapter.createRouter(pipeline));
      }
    }
  }

  // Global error handler (must be last, 4-arg signature)
  app.use(errorHandler);

  return app;
}
