// ---------------------------------------------------------------------------
// UCP routes — Universal Commerce Protocol checkout session lifecycle
// ---------------------------------------------------------------------------

import { Router } from "express";
import type { UcpSessionStore } from "@ygn-stem/commerce";

export function createUcpRouter(store: UcpSessionStore): Router {
  const router = Router();

  // --------------------------------------------------------------------------
  // POST /ucp/sessions — create a checkout session
  // Requires Idempotency-Key header.
  // --------------------------------------------------------------------------

  router.post("/ucp/sessions", (req, res) => {
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

    if (!idempotencyKey) {
      res.status(400).json({ error: "Missing required header: Idempotency-Key" });
      return;
    }

    const { items, currency } = req.body as {
      items: Array<{ sku: string; name: string; quantity: number; unitPrice: number }>;
      currency: string;
    };

    const session = store.createSession({ items, currency, idempotencyKey });
    res.status(201).json(session);
  });

  // --------------------------------------------------------------------------
  // GET /ucp/sessions/:id — retrieve a session by ID
  // --------------------------------------------------------------------------

  router.get("/ucp/sessions/:id", (req, res) => {
    const session = store.getSession(req.params.id);
    if (session === undefined) {
      res.status(404).json({ error: `Session not found: ${req.params.id}` });
      return;
    }
    res.status(200).json(session);
  });

  // --------------------------------------------------------------------------
  // POST /ucp/sessions/:id/complete — mark session as completed
  // --------------------------------------------------------------------------

  router.post("/ucp/sessions/:id/complete", (req, res) => {
    // Check existence first so we can return 404 vs 400 correctly.
    const existing = store.getSession(req.params.id);
    if (existing === undefined) {
      res.status(404).json({ error: `Session not found: ${req.params.id}` });
      return;
    }

    try {
      const session = store.completeSession(req.params.id);
      res.status(200).json(session);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}
