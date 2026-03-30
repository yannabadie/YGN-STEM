import { describe, it, expect } from "vitest";
import request from "supertest";
import { createGateway } from "../gateway.js";
import { OrganRegistry } from "@ygn-stem/connectors";

describe("A2UI Dynamic UI Composition", () => {
  const registry = new OrganRegistry();
  const app = createGateway({ registry });

  // POST /a2ui/render --------------------------------------------------------

  it("POST /a2ui/render returns a surface with components", async () => {
    const res = await request(app)
      .post("/a2ui/render")
      .send({ message: "Hello world", context: "Some context" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("components");
    expect(Array.isArray(res.body.components)).toBe(true);
    expect(res.body.components.length).toBeGreaterThan(0);
  });

  it("surface has valid component structure (id, type, props, children)", async () => {
    const res = await request(app)
      .post("/a2ui/render")
      .send({ message: "Test" });

    expect(res.status).toBe(200);
    for (const component of res.body.components) {
      expect(component).toHaveProperty("id");
      expect(typeof component.id).toBe("string");
      expect(component.id.length).toBeGreaterThan(0);

      expect(component).toHaveProperty("type");
      expect(typeof component.type).toBe("string");

      expect(component).toHaveProperty("props");
      expect(typeof component.props).toBe("object");

      expect(component).toHaveProperty("children");
      expect(Array.isArray(component.children)).toBe(true);
    }
  });

  it("surface rootIds reference existing component IDs", async () => {
    const res = await request(app)
      .post("/a2ui/render")
      .send({ message: "Check root IDs" });

    expect(res.status).toBe(200);
    const { components, rootIds } = res.body;
    const componentIds = new Set(components.map((c: { id: string }) => c.id));

    expect(Array.isArray(rootIds)).toBe(true);
    expect(rootIds.length).toBeGreaterThan(0);
    for (const rootId of rootIds) {
      expect(componentIds.has(rootId)).toBe(true);
    }
  });

  it("surface has title from message", async () => {
    const res = await request(app)
      .post("/a2ui/render")
      .send({ message: "My Title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("My Title");
  });

  it("components include a button with events", async () => {
    const res = await request(app)
      .post("/a2ui/render")
      .send({ message: "Show button" });

    expect(res.status).toBe(200);
    const button = res.body.components.find(
      (c: { type: string }) => c.type === "button",
    );
    expect(button).toBeDefined();
    expect(Array.isArray(button.events)).toBe(true);
    expect(button.events.length).toBeGreaterThan(0);
  });

  // POST /a2ui/action --------------------------------------------------------

  it("POST /a2ui/action acknowledges a valid action", async () => {
    const res = await request(app)
      .post("/a2ui/action")
      .send({
        surfaceId: "surface-123",
        componentId: "action-1",
        event: "click",
        payload: { value: "ok" },
      });

    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
    expect(res.body.action.surfaceId).toBe("surface-123");
    expect(res.body.action.componentId).toBe("action-1");
    expect(res.body.action.event).toBe("click");
  });

  it("POST /a2ui/action rejects missing surfaceId (400)", async () => {
    const res = await request(app)
      .post("/a2ui/action")
      .send({
        componentId: "action-1",
        event: "click",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("POST /a2ui/action rejects missing componentId (400)", async () => {
    const res = await request(app)
      .post("/a2ui/action")
      .send({
        surfaceId: "surface-123",
        event: "click",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("POST /a2ui/action rejects missing event (400)", async () => {
    const res = await request(app)
      .post("/a2ui/action")
      .send({
        surfaceId: "surface-123",
        componentId: "action-1",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
