import { describe, it, expect } from "vitest";

// ---- Common schemas ----
import {
  RequestIdSchema,
  CallerIdSchema,
  TimestampSchema,
  OutcomeSchema,
  EmbeddingSchema,
  ImportanceScoreSchema,
  ConfidenceSchema,
} from "../schemas/common.js";

// ---- Memory schemas ----
import {
  FactTripleSchema,
  EpisodeSchema,
  EntitySummarySchema,
  ProfileDimensionSchema,
  CallerProfileSchema,
  RetainInputSchema,
  RecallQuerySchema,
  RecallResultSchema,
} from "../schemas/memory.js";

// ---- Skill schemas ----
import {
  SkillMaturitySchema,
  SkillSchema,
  SkillMatchResultSchema,
  SkillOutcomeSchema,
} from "../schemas/skill.js";

// ---- Organ schemas ----
import {
  OrganStatusSchema,
  TransportTypeSchema,
  OrganConfigSchema,
  OrganInfoSchema,
  ToolDescriptorSchema,
} from "../schemas/organ.js";

// ---- Protocol schemas ----
import {
  A2ATaskStateSchema,
  A2ATaskSchema,
  AgentCardSchema,
  AgUiEventTypeSchema,
  AgUiEventSchema,
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
} from "../schemas/protocol.js";

// ---- Caller schemas ----
import {
  TaskPropertySchema,
  ArchitectureChoiceSchema,
  OrganRoutingSchema,
} from "../schemas/caller.js";

// ---- Commerce schemas ----
import {
  UcpItemSchema,
  UcpSessionSchema,
  PaymentIntentSchema,
  PaymentMandateSchema,
  PaymentReceiptSchema,
} from "../schemas/commerce.js";

// ---- Errors ----
import {
  StemError,
  OrganUnavailableError,
  CircuitOpenError,
  CallerNotFoundError,
  SkillNotFoundError,
} from "../errors.js";

// ===========================================================================
// Common schemas
// ===========================================================================

describe("RequestIdSchema", () => {
  it("accepts a non-empty string", () => {
    expect(RequestIdSchema.parse("req-abc-123")).toBe("req-abc-123");
  });

  it("rejects an empty string", () => {
    expect(() => RequestIdSchema.parse("")).toThrow();
  });

  it("rejects non-string values", () => {
    expect(() => RequestIdSchema.parse(42)).toThrow();
    expect(() => RequestIdSchema.parse(null)).toThrow();
  });
});

describe("CallerIdSchema", () => {
  it("accepts a non-empty string", () => {
    expect(CallerIdSchema.parse("caller-001")).toBe("caller-001");
  });

  it("rejects an empty string", () => {
    expect(() => CallerIdSchema.parse("")).toThrow();
  });
});

describe("TimestampSchema", () => {
  it("accepts a valid ISO datetime string", () => {
    const ts = "2026-01-01T00:00:00.000Z";
    expect(TimestampSchema.parse(ts)).toBe(ts);
  });

  it("rejects a non-datetime string", () => {
    expect(() => TimestampSchema.parse("not-a-date")).toThrow();
  });
});

describe("OutcomeSchema", () => {
  it("accepts success", () => {
    expect(OutcomeSchema.parse("success")).toBe("success");
  });

  it("accepts failure", () => {
    expect(OutcomeSchema.parse("failure")).toBe("failure");
  });

  it("accepts partial", () => {
    expect(OutcomeSchema.parse("partial")).toBe("partial");
  });

  it("rejects unknown value", () => {
    expect(() => OutcomeSchema.parse("unknown")).toThrow();
  });
});

describe("EmbeddingSchema", () => {
  it("accepts an array of numbers", () => {
    const embedding = [0.1, 0.2, -0.5, 0.9];
    expect(EmbeddingSchema.parse(embedding)).toEqual(embedding);
  });

  it("rejects an array containing non-numbers", () => {
    expect(() => EmbeddingSchema.parse(["a", "b"])).toThrow();
  });

  it("rejects a non-array", () => {
    expect(() => EmbeddingSchema.parse("vector")).toThrow();
  });
});

describe("ImportanceScoreSchema", () => {
  it("accepts 0", () => {
    expect(ImportanceScoreSchema.parse(0)).toBe(0);
  });

  it("accepts 1", () => {
    expect(ImportanceScoreSchema.parse(1)).toBe(1);
  });

  it("accepts 0.5", () => {
    expect(ImportanceScoreSchema.parse(0.5)).toBe(0.5);
  });

  it("rejects values below 0", () => {
    expect(() => ImportanceScoreSchema.parse(-0.1)).toThrow();
  });

  it("rejects values above 1", () => {
    expect(() => ImportanceScoreSchema.parse(1.1)).toThrow();
  });
});

describe("ConfidenceSchema", () => {
  it("accepts 0", () => {
    expect(ConfidenceSchema.parse(0)).toBe(0);
  });

  it("accepts 1", () => {
    expect(ConfidenceSchema.parse(1)).toBe(1);
  });

  it("rejects values outside [0,1]", () => {
    expect(() => ConfidenceSchema.parse(-1)).toThrow();
    expect(() => ConfidenceSchema.parse(2)).toThrow();
  });
});

// ===========================================================================
// Memory schemas
// ===========================================================================

describe("FactTripleSchema", () => {
  it("accepts a valid triple", () => {
    const triple = {
      subject: "Alice",
      predicate: "knows",
      object: "Bob",
    };
    expect(FactTripleSchema.parse(triple)).toEqual(triple);
  });

  it("rejects missing fields", () => {
    expect(() => FactTripleSchema.parse({ subject: "Alice" })).toThrow();
  });
});

describe("EpisodeSchema", () => {
  const validEpisode = {
    id: "ep-001",
    callerId: "caller-001",
    requestId: "req-001",
    summary: "User asked about the weather",
    importance: 0.7,
    timestamp: "2026-01-01T00:00:00.000Z",
  };

  it("accepts a valid episode", () => {
    expect(EpisodeSchema.parse(validEpisode)).toMatchObject({
      id: "ep-001",
      importance: 0.7,
    });
  });

  it("rejects importance below 0", () => {
    expect(() =>
      EpisodeSchema.parse({ ...validEpisode, importance: -0.1 }),
    ).toThrow();
  });

  it("rejects importance above 1", () => {
    expect(() =>
      EpisodeSchema.parse({ ...validEpisode, importance: 1.5 }),
    ).toThrow();
  });

  it("accepts optional embedding", () => {
    const withEmbedding = { ...validEpisode, embedding: [0.1, 0.2, 0.3] };
    expect(EpisodeSchema.parse(withEmbedding)).toMatchObject({
      embedding: [0.1, 0.2, 0.3],
    });
  });
});

describe("EntitySummarySchema", () => {
  it("accepts a valid entity summary", () => {
    const summary = {
      entityId: "entity-001",
      entityType: "person",
      summary: "A software developer",
      cueAnchors: ["developer", "engineer"],
      lastUpdated: "2026-01-01T00:00:00.000Z",
    };
    expect(EntitySummarySchema.parse(summary)).toMatchObject({
      entityId: "entity-001",
      cueAnchors: ["developer", "engineer"],
    });
  });

  it("rejects missing cueAnchors", () => {
    expect(() =>
      EntitySummarySchema.parse({
        entityId: "e-001",
        entityType: "person",
        summary: "test",
        lastUpdated: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("ProfileDimensionSchema", () => {
  it("accepts a valid profile dimension", () => {
    const dim = {
      key: "expertise",
      value: "TypeScript",
      confidence: 0.9,
    };
    expect(ProfileDimensionSchema.parse(dim)).toMatchObject(dim);
  });
});

describe("CallerProfileSchema", () => {
  it("accepts a valid caller profile", () => {
    const profile = {
      callerId: "caller-001",
      dimensions: [{ key: "expertise", value: "TypeScript", confidence: 0.9 }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(CallerProfileSchema.parse(profile)).toMatchObject({
      callerId: "caller-001",
    });
  });
});

describe("RetainInputSchema", () => {
  it("accepts a valid retain input", () => {
    const input = {
      callerId: "caller-001",
      requestId: "req-001",
      content: "User asked about TypeScript",
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    expect(RetainInputSchema.parse(input)).toMatchObject({ content: "User asked about TypeScript" });
  });
});

describe("RecallQuerySchema", () => {
  it("accepts a valid recall query", () => {
    const query = {
      callerId: "caller-001",
      query: "What did the user ask yesterday?",
    };
    expect(RecallQuerySchema.parse(query)).toMatchObject(query);
  });

  it("accepts optional limit", () => {
    const query = {
      callerId: "caller-001",
      query: "test",
      limit: 10,
    };
    expect(RecallQuerySchema.parse(query)).toMatchObject({ limit: 10 });
  });
});

describe("RecallResultSchema", () => {
  it("accepts a valid recall result", () => {
    const result = {
      episodes: [],
      facts: [],
      totalFound: 0,
    };
    expect(RecallResultSchema.parse(result)).toMatchObject(result);
  });
});

// ===========================================================================
// Skill schemas
// ===========================================================================

describe("SkillMaturitySchema", () => {
  const validValues = ["nascent", "developing", "proficient", "expert", "deprecated"];

  it.each(validValues)("accepts '%s'", (value) => {
    expect(SkillMaturitySchema.parse(value)).toBe(value);
  });

  it("rejects unknown maturity level", () => {
    expect(() => SkillMaturitySchema.parse("master")).toThrow();
  });
});

describe("SkillSchema", () => {
  const validSkill = {
    id: "skill-001",
    name: "TypeScript Expert",
    description: "Expertise in TypeScript development",
    maturity: "proficient",
    tags: ["typescript", "programming"],
    version: "1.0.0",
  };

  it("accepts a valid skill", () => {
    expect(SkillSchema.parse(validSkill)).toMatchObject({
      id: "skill-001",
      maturity: "proficient",
    });
  });

  it("rejects invalid maturity", () => {
    expect(() =>
      SkillSchema.parse({ ...validSkill, maturity: "godlike" }),
    ).toThrow();
  });
});

describe("SkillMatchResultSchema", () => {
  it("accepts a valid match result", () => {
    const result = {
      skillId: "skill-001",
      score: 0.95,
      reasons: ["keyword match", "context match"],
    };
    expect(SkillMatchResultSchema.parse(result)).toMatchObject(result);
  });
});

describe("SkillOutcomeSchema", () => {
  it("accepts a valid skill outcome", () => {
    const outcome = {
      skillId: "skill-001",
      requestId: "req-001",
      outcome: "success",
      durationMs: 250,
    };
    expect(SkillOutcomeSchema.parse(outcome)).toMatchObject(outcome);
  });

  it("rejects invalid outcome value", () => {
    const outcome = {
      skillId: "skill-001",
      requestId: "req-001",
      outcome: "catastrophic",
      durationMs: 250,
    };
    expect(() => SkillOutcomeSchema.parse(outcome)).toThrow();
  });
});

// ===========================================================================
// Organ schemas
// ===========================================================================

describe("OrganStatusSchema", () => {
  const validValues = ["healthy", "degraded", "unavailable", "unknown"];

  it.each(validValues)("accepts '%s'", (value) => {
    expect(OrganStatusSchema.parse(value)).toBe(value);
  });

  it("rejects unknown status", () => {
    expect(() => OrganStatusSchema.parse("broken")).toThrow();
  });
});

describe("TransportTypeSchema", () => {
  const validValues = ["http", "grpc", "stdio", "websocket"];

  it.each(validValues)("accepts '%s'", (value) => {
    expect(TransportTypeSchema.parse(value)).toBe(value);
  });
});

describe("OrganConfigSchema", () => {
  it("accepts a valid organ config with http transport", () => {
    const config = {
      organId: "organ-db-001",
      transport: "http",
      endpoint: "http://localhost:8080",
      timeoutMs: 5000,
    };
    expect(OrganConfigSchema.parse(config)).toMatchObject({
      transport: "http",
      endpoint: "http://localhost:8080",
    });
  });

  it("rejects invalid transport", () => {
    const config = {
      organId: "organ-001",
      transport: "carrier-pigeon",
      endpoint: "somewhere",
      timeoutMs: 1000,
    };
    expect(() => OrganConfigSchema.parse(config)).toThrow();
  });
});

describe("OrganInfoSchema", () => {
  it("accepts a valid organ info", () => {
    const info = {
      organId: "organ-001",
      name: "Memory Store",
      status: "healthy",
      transport: "http",
      version: "1.0.0",
    };
    expect(OrganInfoSchema.parse(info)).toMatchObject({ status: "healthy" });
  });
});

describe("ToolDescriptorSchema", () => {
  it("accepts a valid tool descriptor", () => {
    const tool = {
      name: "search_memory",
      description: "Search the memory store",
      inputSchema: { type: "object" },
    };
    expect(ToolDescriptorSchema.parse(tool)).toMatchObject({ name: "search_memory" });
  });
});

// ===========================================================================
// Protocol schemas
// ===========================================================================

describe("A2ATaskStateSchema", () => {
  const validValues = ["submitted", "working", "completed", "failed", "canceled"];

  it.each(validValues)("accepts '%s'", (value) => {
    expect(A2ATaskStateSchema.parse(value)).toBe(value);
  });

  it("rejects unknown state", () => {
    expect(() => A2ATaskStateSchema.parse("pending")).toThrow();
  });
});

describe("A2ATaskSchema", () => {
  it("accepts a valid A2A task", () => {
    const task = {
      id: "task-001",
      state: "submitted",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(A2ATaskSchema.parse(task)).toMatchObject({ state: "submitted" });
  });
});

describe("AgentCardSchema", () => {
  it("accepts a valid agent card", () => {
    const card = {
      name: "YGN-STEM",
      description: "AI memory and reasoning system",
      version: "0.1.0",
      url: "https://stem.ygn.ai",
      capabilities: ["memory", "reasoning"],
    };
    expect(AgentCardSchema.parse(card)).toMatchObject({ name: "YGN-STEM" });
  });
});

describe("AgUiEventTypeSchema", () => {
  const validValues = [
    "run_started",
    "run_finished",
    "run_error",
    "text_message_start",
    "text_message_content",
    "text_message_end",
    "tool_call_start",
    "tool_call_end",
  ];

  it.each(validValues)("accepts '%s'", (value) => {
    expect(AgUiEventTypeSchema.parse(value)).toBe(value);
  });
});

describe("AgUiEventSchema", () => {
  it("accepts a valid AgUI event", () => {
    const event = {
      type: "run_started",
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    expect(AgUiEventSchema.parse(event)).toMatchObject({ type: "run_started" });
  });
});

describe("JsonRpcRequestSchema", () => {
  it("accepts a valid JSON-RPC 2.0 request", () => {
    const request = {
      jsonrpc: "2.0",
      method: "memory/retain",
      id: "req-001",
      params: { content: "Hello world" },
    };
    expect(JsonRpcRequestSchema.parse(request)).toMatchObject({
      jsonrpc: "2.0",
      method: "memory/retain",
    });
  });

  it("rejects wrong jsonrpc version", () => {
    const request = {
      jsonrpc: "1.0",
      method: "test",
      id: "1",
    };
    expect(() => JsonRpcRequestSchema.parse(request)).toThrow();
  });

  it("accepts request without params (optional)", () => {
    const request = {
      jsonrpc: "2.0",
      method: "ping",
      id: "1",
    };
    expect(JsonRpcRequestSchema.parse(request)).toMatchObject({ method: "ping" });
  });
});

describe("JsonRpcResponseSchema", () => {
  it("accepts a valid successful JSON-RPC response", () => {
    const response = {
      jsonrpc: "2.0",
      id: "req-001",
      result: { status: "ok" },
    };
    expect(JsonRpcResponseSchema.parse(response)).toMatchObject({ result: { status: "ok" } });
  });

  it("accepts a JSON-RPC error response", () => {
    const response = {
      jsonrpc: "2.0",
      id: "req-001",
      error: { code: -32600, message: "Invalid Request" },
    };
    expect(JsonRpcResponseSchema.parse(response)).toMatchObject({
      error: { code: -32600 },
    });
  });
});

// ===========================================================================
// Caller schemas
// ===========================================================================

describe("TaskPropertySchema", () => {
  it("accepts a valid task property", () => {
    const prop = {
      key: "complexity",
      value: "high",
    };
    expect(TaskPropertySchema.parse(prop)).toMatchObject(prop);
  });
});

describe("ArchitectureChoiceSchema", () => {
  const validValues = [
    "smt-pipeline",
    "adversarial-redblue",
    "knowledge-pipeline",
    "centralized-multi-agent",
    "direct-llm",
    "single-agent",
  ];

  it.each(validValues)("accepts '%s'", (value) => {
    expect(ArchitectureChoiceSchema.parse(value)).toBe(value);
  });

  it("rejects unknown architecture", () => {
    expect(() => ArchitectureChoiceSchema.parse("quantum")).toThrow();
  });
});

describe("OrganRoutingSchema", () => {
  it("accepts a valid organ routing", () => {
    const routing = {
      organId: "organ-001",
      priority: 1,
      fallback: false,
    };
    expect(OrganRoutingSchema.parse(routing)).toMatchObject(routing);
  });
});

// ===========================================================================
// Commerce schemas
// ===========================================================================

describe("UcpItemSchema", () => {
  it("accepts a valid item", () => {
    const item = { name: "Textbook", quantity: 2, unitPrice: 25 };
    expect(UcpItemSchema.parse(item)).toMatchObject(item);
  });

  it("rejects zero quantity", () => {
    expect(() => UcpItemSchema.parse({ name: "X", quantity: 0, unitPrice: 10 })).toThrow();
  });

  it("rejects negative unitPrice", () => {
    expect(() => UcpItemSchema.parse({ name: "X", quantity: 1, unitPrice: -1 })).toThrow();
  });
});

describe("UcpSessionSchema", () => {
  const validSession = {
    id: "session-001",
    status: "created" as const,
    items: [{ name: "Book", quantity: 1, unitPrice: 20 }],
    total: 20,
    currency: "USD",
    createdAt: "2026-01-01T00:00:00.000Z",
    idempotencyKey: "key-abc",
  };

  it("accepts a valid session", () => {
    expect(UcpSessionSchema.parse(validSession)).toMatchObject({ id: "session-001" });
  });

  it("accepts optional completedAt", () => {
    const withCompleted = { ...validSession, status: "completed" as const, completedAt: "2026-01-01T01:00:00.000Z" };
    expect(UcpSessionSchema.parse(withCompleted)).toMatchObject({ status: "completed" });
  });

  it("rejects invalid status", () => {
    expect(() => UcpSessionSchema.parse({ ...validSession, status: "pending" })).toThrow();
  });
});

describe("PaymentIntentSchema", () => {
  const validIntent = {
    id: "intent-001",
    amount: 100,
    currency: "USD",
    description: "Course enrollment",
    status: "pending" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts a valid intent", () => {
    expect(PaymentIntentSchema.parse(validIntent)).toMatchObject({ id: "intent-001" });
  });

  it("accepts optional autoApproveThreshold", () => {
    const withThreshold = { ...validIntent, autoApproveThreshold: 50 };
    expect(PaymentIntentSchema.parse(withThreshold)).toMatchObject({ autoApproveThreshold: 50 });
  });

  it("rejects invalid status", () => {
    expect(() => PaymentIntentSchema.parse({ ...validIntent, status: "cancelled" })).toThrow();
  });
});

describe("PaymentMandateSchema", () => {
  const validMandate = {
    id: "mandate-001",
    intentId: "intent-001",
    amount: 100,
    currency: "USD",
    status: "pending" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts a valid mandate", () => {
    expect(PaymentMandateSchema.parse(validMandate)).toMatchObject({ id: "mandate-001" });
  });

  it("accepts optional approvedBy and executedAt", () => {
    const executed = {
      ...validMandate,
      status: "executed" as const,
      approvedBy: "admin",
      executedAt: "2026-01-01T01:00:00.000Z",
    };
    expect(PaymentMandateSchema.parse(executed)).toMatchObject({ approvedBy: "admin" });
  });

  it("rejects invalid status", () => {
    expect(() => PaymentMandateSchema.parse({ ...validMandate, status: "approved" })).toThrow();
  });
});

describe("PaymentReceiptSchema", () => {
  const validReceipt = {
    id: "receipt-001",
    mandateId: "mandate-001",
    amount: 100,
    currency: "USD",
    status: "confirmed" as const,
    transactionRef: "txn-001",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts a valid receipt", () => {
    expect(PaymentReceiptSchema.parse(validReceipt)).toMatchObject({ id: "receipt-001" });
  });

  it("rejects non-confirmed status", () => {
    expect(() => PaymentReceiptSchema.parse({ ...validReceipt, status: "pending" })).toThrow();
  });
});

// ===========================================================================
// Errors
// ===========================================================================

describe("StemError", () => {
  it("is an instance of Error", () => {
    const err = new StemError("test error", "TEST_ERROR");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StemError);
  });

  it("has code property", () => {
    const err = new StemError("test error", "TEST_ERROR");
    expect(err.code).toBe("TEST_ERROR");
  });

  it("has correct message", () => {
    const err = new StemError("test error", "TEST_ERROR");
    expect(err.message).toBe("test error");
  });
});

describe("OrganUnavailableError", () => {
  it("is an instance of StemError", () => {
    const err = new OrganUnavailableError("organ-001");
    expect(err).toBeInstanceOf(StemError);
    expect(err).toBeInstanceOf(OrganUnavailableError);
  });

  it("includes organId in message", () => {
    const err = new OrganUnavailableError("organ-001");
    expect(err.message).toContain("organ-001");
  });

  it("has ORGAN_UNAVAILABLE code", () => {
    const err = new OrganUnavailableError("organ-001");
    expect(err.code).toBe("ORGAN_UNAVAILABLE");
  });
});

describe("CircuitOpenError", () => {
  it("is an instance of StemError", () => {
    const err = new CircuitOpenError("organ-002");
    expect(err).toBeInstanceOf(StemError);
  });

  it("has CIRCUIT_OPEN code", () => {
    const err = new CircuitOpenError("organ-002");
    expect(err.code).toBe("CIRCUIT_OPEN");
  });
});

describe("CallerNotFoundError", () => {
  it("is an instance of StemError", () => {
    const err = new CallerNotFoundError("caller-999");
    expect(err).toBeInstanceOf(StemError);
  });

  it("has CALLER_NOT_FOUND code", () => {
    const err = new CallerNotFoundError("caller-999");
    expect(err.code).toBe("CALLER_NOT_FOUND");
  });

  it("includes callerId in message", () => {
    const err = new CallerNotFoundError("caller-999");
    expect(err.message).toContain("caller-999");
  });
});

describe("SkillNotFoundError", () => {
  it("is an instance of StemError", () => {
    const err = new SkillNotFoundError("skill-999");
    expect(err).toBeInstanceOf(StemError);
  });

  it("has SKILL_NOT_FOUND code", () => {
    const err = new SkillNotFoundError("skill-999");
    expect(err.code).toBe("SKILL_NOT_FOUND");
  });

  it("includes skillId in message", () => {
    const err = new SkillNotFoundError("skill-999");
    expect(err.message).toContain("skill-999");
  });
});
