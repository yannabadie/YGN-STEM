import { Router } from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";

export function createHealthRouter(registry: OrganRegistry): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const organs = registry.list();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      organs: organs.map((o) => ({ name: o.name, status: o.status })),
    });
  });

  router.get("/organs", (_req, res) => {
    res.json(registry.list());
  });

  return router;
}
