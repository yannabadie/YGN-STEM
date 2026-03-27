import express from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";
import { requestId } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createHealthRouter } from "./routes/health.js";
import { createA2ARouter } from "./routes/a2a.js";
import { createMcpRouter } from "./routes/mcp.js";

export interface GatewayOptions {
  registry: OrganRegistry;
}

export function createGateway(options: GatewayOptions): express.Express {
  const { registry } = options;
  const app = express();

  // Body parsing
  app.use(express.json());

  // Correlation ID on every request
  app.use(requestId);

  // Route handlers
  app.use(createHealthRouter(registry));
  app.use(createA2ARouter(registry));
  app.use(createMcpRouter(registry));

  // Global error handler (must be last, 4-arg signature)
  app.use(errorHandler);

  return app;
}
