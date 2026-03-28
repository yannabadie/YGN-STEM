import { describe, it, expect } from "vitest";
import request from "supertest";
import { createGateway } from "../gateway.js";
import { OrganRegistry } from "@ygn-stem/connectors";

describe("AG-UI SSE", () => {
  const registry = new OrganRegistry();
  const app = createGateway({ registry });

  it("GET /ag-ui/stream returns SSE headers", async () => {
    const res = await request(app)
      .get("/ag-ui/stream")
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk));
        // Close after first event
        setTimeout(() => {
          res.destroy();
          callback(null, data);
        }, 100);
      });

    expect(res.headers["content-type"]).toContain("text/event-stream");
  });

  it("POST /ag-ui/run streams pipeline events", async () => {
    const res = await request(app)
      .post("/ag-ui/run")
      .send({ message: "test query", callerId: "alice" })
      .buffer(true)
      .parse((res, callback) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk));
        res.on("end", () => callback(null, data));
      });

    expect(res.body).toContain("event: RUN_STARTED");
    expect(res.body).toContain("event: RUN_FINISHED");
    expect(res.body).toContain("event: TEXT_MESSAGE_CONTENT");
  });
});
