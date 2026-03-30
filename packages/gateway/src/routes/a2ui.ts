import { Router } from "express";

export function a2uiRouter(): Router {
  const router = Router();

  // POST /a2ui/render — render a UI surface from a request
  router.post("/a2ui/render", (req, res) => {
    const { message, context } = req.body;

    // Generate a simple UI surface based on the request
    // In a real implementation, the pipeline would determine what UI to render
    const surface = {
      id: `surface-${Date.now()}`,
      title: message ?? "Agent Response",
      components: [
        {
          id: "heading-1",
          type: "heading",
          props: { level: 2, text: message ?? "Response" },
          children: [],
          events: [],
        },
        {
          id: "content-1",
          type: "paragraph",
          props: { text: context ?? "Processing your request..." },
          children: [],
          events: [],
        },
        {
          id: "action-1",
          type: "button",
          props: { label: "Continue", variant: "primary" },
          children: [],
          events: ["click"],
        },
      ],
      rootIds: ["heading-1", "content-1", "action-1"],
    };

    res.json(surface);
  });

  // POST /a2ui/action — handle client action on a component
  router.post("/a2ui/action", (req, res) => {
    const action = req.body;
    // Validate action
    if (!action.surfaceId || !action.componentId || !action.event) {
      res.status(400).json({ error: "Missing required action fields" });
      return;
    }
    // Return acknowledgment + optional updated surface
    res.json({
      acknowledged: true,
      action: {
        surfaceId: action.surfaceId,
        componentId: action.componentId,
        event: action.event,
      },
      // In real implementation, pipeline would process the action and return updated surface
    });
  });

  return router;
}
