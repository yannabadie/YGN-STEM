// ---------------------------------------------------------------------------
// AP2 routes — Agent Payments Protocol (Intent → Mandate → Receipt)
// ---------------------------------------------------------------------------

import { Router } from "express";
import type { Ap2Store } from "@ygn-stem/commerce";

export function createAp2Router(store: Ap2Store): Router {
  const router = Router();

  // --------------------------------------------------------------------------
  // POST /ap2/intents — create a payment intent
  // --------------------------------------------------------------------------

  router.post("/ap2/intents", (req, res) => {
    const { amount, currency, description, autoApproveThreshold } = req.body as {
      amount: number;
      currency: string;
      description: string;
      autoApproveThreshold?: number;
    };

    const intent = store.createIntent({
      amount,
      currency,
      description,
      autoApproveThreshold,
    });

    res.status(201).json(intent);
  });

  // --------------------------------------------------------------------------
  // GET /ap2/intents/:id — retrieve a payment intent
  // --------------------------------------------------------------------------

  router.get("/ap2/intents/:id", (req, res) => {
    const intent = store.getIntent(req.params.id);
    if (intent === undefined) {
      res.status(404).json({ error: `Intent not found: ${req.params.id}` });
      return;
    }
    res.status(200).json(intent);
  });

  // --------------------------------------------------------------------------
  // POST /ap2/intents/:id/approve — approve a pending intent, returns mandate
  // --------------------------------------------------------------------------

  router.post("/ap2/intents/:id/approve", (req, res) => {
    const intent = store.getIntent(req.params.id);
    if (intent === undefined) {
      res.status(404).json({ error: `Intent not found: ${req.params.id}` });
      return;
    }

    const { approvedBy } = req.body as { approvedBy: string };

    try {
      const mandate = store.approveIntent(req.params.id, approvedBy);
      res.status(201).json(mandate);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /ap2/intents/:id/reject — reject a pending intent
  // --------------------------------------------------------------------------

  router.post("/ap2/intents/:id/reject", (req, res) => {
    const intent = store.getIntent(req.params.id);
    if (intent === undefined) {
      res.status(404).json({ error: `Intent not found: ${req.params.id}` });
      return;
    }

    const { reason } = req.body as { reason: string };

    try {
      const rejected = store.rejectIntent(req.params.id, reason);
      res.status(200).json(rejected);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /ap2/mandates/:id/execute — execute a mandate, returns receipt
  // --------------------------------------------------------------------------

  router.post("/ap2/mandates/:id/execute", (req, res) => {
    const mandate = store.getMandate(req.params.id);
    if (mandate === undefined) {
      res.status(404).json({ error: `Mandate not found: ${req.params.id}` });
      return;
    }

    try {
      const receipt = store.executeMandate(req.params.id);
      res.status(201).json(receipt);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /ap2/audit — return audit trail (optional ?intentId= filter)
  // --------------------------------------------------------------------------

  router.get("/ap2/audit", (req, res) => {
    const intentId = req.query.intentId as string | undefined;
    const trail = store.getAuditTrail(intentId);
    res.status(200).json(trail);
  });

  return router;
}
