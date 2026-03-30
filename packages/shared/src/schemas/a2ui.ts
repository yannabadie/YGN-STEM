import { z } from "zod";

export const A2uiComponentTypeSchema = z.enum([
  "text", "heading", "paragraph", "code",
  "button", "input", "select", "checkbox",
  "card", "list", "table", "image",
  "container", "row", "column", "divider",
]);
export type A2uiComponentType = z.infer<typeof A2uiComponentTypeSchema>;

export const A2uiComponentSchema = z.object({
  id: z.string().min(1),
  type: A2uiComponentTypeSchema,
  props: z.record(z.string(), z.unknown()).default({}),
  children: z.array(z.string()).default([]),  // child IDs (adjacency list)
  events: z.array(z.string()).default([]),     // event names this component emits
});
export type A2uiComponent = z.infer<typeof A2uiComponentSchema>;

export const A2uiSurfaceSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  components: z.array(A2uiComponentSchema),
  rootIds: z.array(z.string()),  // top-level component IDs
});
export type A2uiSurface = z.infer<typeof A2uiSurfaceSchema>;

export const A2uiActionSchema = z.object({
  surfaceId: z.string().min(1),
  componentId: z.string().min(1),
  event: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type A2uiAction = z.infer<typeof A2uiActionSchema>;
