import { Router } from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";
import type { AgentCard } from "@ygn-stem/shared";

export function createA2ARouter(registry: OrganRegistry): Router {
  const router = Router();

  router.get("/.well-known/agent.json", (_req, res) => {
    const tools = registry.allTools();
    const agentCard: AgentCard = {
      name: "YGN-STEM",
      description:
        "YGN-STEM is an adaptive multi-organ AI gateway that aggregates tools from registered organ connectors and exposes them via MCP (Model Context Protocol) and A2A (Agent-to-Agent) interfaces.",
      version: "0.1.0",
      url: "http://localhost:3000",
      capabilities: ["tools/list", "tools/call", "health", "organs"],
      skills: tools.map((t) => t.name),
      contact: "https://github.com/yannabadie/YGN-STEM",
    };
    res.json(agentCard);
  });

  return router;
}
