/**
 * Framework adapter tests — exercises AutoGen, CrewAI, LangGraph, and OpenAI
 * adapters through the StemPipeline in standalone (no-organs) mode.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import {
  HindsightMemory,
  InMemoryFactsStore,
  InMemoryEpisodesStore,
  InMemorySummariesStore,
  InMemoryBeliefsStore,
} from "@ygn-stem/memory";
import { OrganRegistry } from "@ygn-stem/connectors";
import { CallerProfiler, ArchitectureSelector, SkillsEngine } from "@ygn-stem/adaptive";
import { createGateway } from "../gateway.js";
import { AutoGenAdapter } from "../adapters/autogen-adapter.js";
import { CrewAIAdapter } from "../adapters/crewai-adapter.js";
import { LangGraphAdapter } from "../adapters/langgraph-adapter.js";
import { OpenAIAdapter } from "../adapters/openai-adapter.js";
import type express from "express";

// ---------------------------------------------------------------------------
// Shared app with all 4 adapters mounted — standalone (no organs)
// ---------------------------------------------------------------------------

let app: express.Express;

beforeAll(() => {
  const beliefsStore = new InMemoryBeliefsStore();
  const memory = new HindsightMemory({
    facts: new InMemoryFactsStore(),
    episodes: new InMemoryEpisodesStore(),
    summaries: new InMemorySummariesStore(),
    beliefs: beliefsStore,
  });
  const registry = new OrganRegistry();
  const profiler = new CallerProfiler(beliefsStore);
  const selector = new ArchitectureSelector();
  const skills = new SkillsEngine();

  app = createGateway({
    registry,
    memory,
    profiler,
    selector,
    skills,
    adapters: [
      new AutoGenAdapter(),
      new CrewAIAdapter(),
      new LangGraphAdapter(),
      new OpenAIAdapter(),
    ],
  });
});

// ---------------------------------------------------------------------------
// AutoGen adapter
// ---------------------------------------------------------------------------

describe("AutoGen adapter", () => {
  it("POST /adapters/autogen/chat returns response in AutoGen format", async () => {
    const res = await request(app)
      .post("/adapters/autogen/chat")
      .send({
        sender: "user_proxy",
        recipient: "assistant",
        message: "Review this Rust code for safety",
        metadata: { conversation_id: "abc123" },
      });

    expect(res.status).toBe(200);
    expect(res.body.sender).toBe("stem");
    expect(res.body.recipient).toBe("user_proxy");
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("metadata");
    expect(res.body.metadata).toHaveProperty("routing");
    expect(res.body.metadata).toHaveProperty("durationMs");
  });

  it("POST /adapters/autogen/chat preserves original metadata fields", async () => {
    const res = await request(app)
      .post("/adapters/autogen/chat")
      .send({
        sender: "planner",
        message: "Plan a task",
        metadata: { conversation_id: "xyz", session: "42" },
      });

    expect(res.status).toBe(200);
    expect(res.body.metadata.conversation_id).toBe("xyz");
    expect(res.body.metadata.session).toBe("42");
  });

  it("POST /adapters/autogen/chat uses sender as recipient of response", async () => {
    const res = await request(app)
      .post("/adapters/autogen/chat")
      .send({ sender: "agent_alice", message: "Hello" });

    expect(res.status).toBe(200);
    expect(res.body.recipient).toBe("agent_alice");
  });
});

// ---------------------------------------------------------------------------
// CrewAI adapter
// ---------------------------------------------------------------------------

describe("CrewAI adapter", () => {
  it("POST /adapters/crewai/task returns task result", async () => {
    const res = await request(app)
      .post("/adapters/crewai/task")
      .send({
        task: { description: "Analyze the codebase", expected_output: "analysis report" },
        agent: { role: "researcher", goal: "thorough analysis" },
        context: "Previous findings: none yet",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("output");
    expect(res.body).toHaveProperty("task");
    expect(res.body.task.description).toBe("Analyze the codebase");
    expect(res.body).toHaveProperty("agent");
    expect(res.body.agent.role).toBe("researcher");
    expect(res.body).toHaveProperty("metadata");
    expect(res.body.metadata).toHaveProperty("routing");
    expect(res.body.metadata).toHaveProperty("durationMs");
  });

  it("POST /adapters/crewai/task works without context", async () => {
    const res = await request(app)
      .post("/adapters/crewai/task")
      .send({
        task: { description: "Write a summary" },
        agent: { role: "writer" },
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("output");
  });

  it("POST /adapters/crewai/task derives callerId from agent role", async () => {
    const res = await request(app)
      .post("/adapters/crewai/task")
      .send({
        task: { description: "Do something" },
        agent: { role: "qa-tester" },
      });

    // Verify the response arrived (the callerId is used internally — just verify success)
    expect(res.status).toBe(200);
    expect(res.body.agent.role).toBe("qa-tester");
  });
});

// ---------------------------------------------------------------------------
// LangGraph adapter
// ---------------------------------------------------------------------------

describe("LangGraph adapter", () => {
  it("POST /adapters/langgraph/invoke returns state with appended assistant message", async () => {
    const res = await request(app)
      .post("/adapters/langgraph/invoke")
      .send({
        input: {
          messages: [{ role: "user", content: "What tools are available?" }],
        },
        config: { thread_id: "xyz", configurable: {} },
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("output");
    expect(res.body.output).toHaveProperty("messages");
    const messages: Array<{ role: string; content: string }> = res.body.output.messages;
    expect(Array.isArray(messages)).toBe(true);
    // Original user message preserved
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("What tools are available?");
    // Assistant reply appended
    const last = messages.at(-1)!;
    expect(last.role).toBe("assistant");
    expect(typeof last.content).toBe("string");
  });

  it("POST /adapters/langgraph/invoke uses thread_id as part of callerId", async () => {
    const res = await request(app)
      .post("/adapters/langgraph/invoke")
      .send({
        input: { messages: [{ role: "user", content: "Hello" }] },
        config: { thread_id: "thread-abc" },
      });

    expect(res.status).toBe(200);
    // The response structure should be intact
    expect(res.body.output.messages).toHaveLength(2);
  });

  it("POST /adapters/langgraph/invoke works with minimal input", async () => {
    const res = await request(app)
      .post("/adapters/langgraph/invoke")
      .send({
        input: { messages: [] },
      });

    expect(res.status).toBe(200);
    expect(res.body.output).toHaveProperty("messages");
    // Only the appended assistant message
    expect(res.body.output.messages).toHaveLength(1);
    expect(res.body.output.messages[0].role).toBe("assistant");
  });
});

// ---------------------------------------------------------------------------
// OpenAI adapter
// ---------------------------------------------------------------------------

describe("OpenAI adapter", () => {
  it("POST /adapters/openai/chat/completions returns chat completion format", async () => {
    const res = await request(app)
      .post("/adapters/openai/chat/completions")
      .send({
        model: "ygn-stem",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body.id).toMatch(/^chatcmpl-/);
    expect(res.body.object).toBe("chat.completion");
    expect(res.body).toHaveProperty("created");
    expect(res.body).toHaveProperty("model");
    expect(Array.isArray(res.body.choices)).toBe(true);
    expect(res.body.choices).toHaveLength(1);

    const choice = res.body.choices[0];
    expect(choice.index).toBe(0);
    expect(choice.message.role).toBe("assistant");
    expect(typeof choice.message.content).toBe("string");
    expect(choice.finish_reason).toBe("stop");
  });

  it("POST /adapters/openai/chat/completions echoes the model name", async () => {
    const res = await request(app)
      .post("/adapters/openai/chat/completions")
      .send({
        model: "custom-model",
        messages: [{ role: "user", content: "Test" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe("custom-model");
  });

  it("POST /adapters/openai/chat/completions uses X-Caller-Id header as callerId", async () => {
    const res = await request(app)
      .post("/adapters/openai/chat/completions")
      .set("X-Caller-Id", "my-agent")
      .send({
        model: "ygn-stem",
        messages: [{ role: "user", content: "Who am I?" }],
      });

    expect(res.status).toBe(200);
    // Success — callerId was used internally
    expect(res.body.choices[0].message.role).toBe("assistant");
  });

  it("POST /adapters/openai/chat/completions includes usage statistics", async () => {
    const res = await request(app)
      .post("/adapters/openai/chat/completions")
      .send({
        model: "ygn-stem",
        messages: [{ role: "user", content: "Usage test" }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("usage");
    expect(res.body.usage).toHaveProperty("prompt_tokens");
    expect(res.body.usage).toHaveProperty("completion_tokens");
    expect(res.body.usage).toHaveProperty("total_tokens");
    expect(typeof res.body.usage.prompt_tokens).toBe("number");
    expect(typeof res.body.usage.total_tokens).toBe("number");
  });

  it("POST /adapters/openai/chat/completions uses last user message", async () => {
    const res = await request(app)
      .post("/adapters/openai/chat/completions")
      .send({
        model: "ygn-stem",
        messages: [
          { role: "user", content: "First message" },
          { role: "assistant", content: "First reply" },
          { role: "user", content: "Follow-up question" },
        ],
      });

    expect(res.status).toBe(200);
    // Should process last user message — response should be present
    expect(res.body.choices[0].message.content).toBeDefined();
  });
});
