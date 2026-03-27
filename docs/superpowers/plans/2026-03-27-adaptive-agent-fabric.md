# YGN-STEM: Adaptive Agent Fabric — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the interoperability and adaptive intelligence layer of the YGN ecosystem — a 4-layer system (Protocol Gateway, Adaptive Intelligence, Hindsight Memory, Organ Connectors) that connects, adapts, memorizes, and orchestrates across all YGN repos.

**Architecture:** TypeScript ESM monorepo with 6 packages (shared, connectors, memory, adaptive, gateway, commerce). Bottom-up build order: shared schemas → connector transports → memory stores → adaptive engines → gateway protocols → commerce handlers. Each package is independently testable. All organs connect via standard protocols (MCP/A2A/CLI) with circuit breakers.

**Tech Stack:** TypeScript 5.8+, Express.js 5, Zod v4, Vitest 3+, Drizzle ORM, PostgreSQL 17 + pgvector, Redis 7+, pnpm 9+, @modelcontextprotocol/sdk, Docker

**Spec:** `docs/superpowers/specs/2026-03-27-adaptive-agent-fabric-design.md`

---

## Phase 1: Monorepo Foundation + Shared Schemas

### Task 1: Scaffold pnpm monorepo

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize pnpm workspace**

```bash
pnpm init
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

Write `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Write root package.json**

Write `package.json`:

```json
{
  "name": "ygn-stem",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint packages/*/src",
    "typecheck": "pnpm -r typecheck",
    "dev": "pnpm --filter @ygn-stem/gateway dev"
  }
}
```

- [ ] **Step 4: Write tsconfig.base.json**

Write `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false
  }
}
```

- [ ] **Step 5: Write root tsconfig.json**

Write `tsconfig.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/connectors" },
    { "path": "packages/memory" },
    { "path": "packages/adaptive" },
    { "path": "packages/gateway" },
    { "path": "packages/commerce" }
  ]
}
```

- [ ] **Step 6: Write vitest.config.ts**

Write `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    projects: ["packages/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
    testTimeout: 10000,
    pool: "threads",
    clearMocks: true,
    restoreMocks: true,
  },
});
```

- [ ] **Step 7: Write .gitignore**

Write `.gitignore`:

```
node_modules/
dist/
coverage/
.env
*.tsbuildinfo
.superpowers/
```

- [ ] **Step 8: Write .env.example**

Write `.env.example`:

```env
# Database
DATABASE_URL=postgresql://stem:stem@localhost:5432/stem

# Redis
REDIS_URL=redis://localhost:6379

# Organ connections (all optional — graceful degradation)
YGN_CORE_MCP=stdio:ygn-core mcp
YGN_BRAIN_MCP=http://localhost:3000/mcp
SAGE_MCP=http://localhost:8001/mcp
SAGE_A2A=http://localhost:8002/a2a
META_YGN_MCP=stdio:aletheiad mcp
META_YGN_HTTP=http://127.0.0.1:7700
ALETHEIA_CLI=aletheia
FINANCE_PIPELINE=python -m src.main --once

# Embeddings (local-first)
EMBEDDING_PROVIDER=arctic

# Gateway
PORT=3000
LOG_LEVEL=info

# Auth (optional)
JWT_SECRET=
OAUTH2_ISSUER=
API_KEY_HEADER=X-API-Key
```

- [ ] **Step 9: Install root dev dependencies**

```bash
pnpm add -Dw vitest typescript @types/node eslint
```

- [ ] **Step 10: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.json tsconfig.base.json vitest.config.ts .gitignore .env.example
git commit -m "feat: scaffold pnpm monorepo with TypeScript + Vitest"
```

---

### Task 2: Create shared package with core schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/schemas/common.ts`
- Create: `packages/shared/src/schemas/memory.ts`
- Create: `packages/shared/src/schemas/skill.ts`
- Create: `packages/shared/src/schemas/protocol.ts`
- Create: `packages/shared/src/schemas/organ.ts`
- Create: `packages/shared/src/schemas/caller.ts`
- Create: `packages/shared/src/errors.ts`
- Test: `packages/shared/src/__tests__/schemas.test.ts`

- [ ] **Step 1: Create shared package.json**

Write `packages/shared/package.json`:

```json
{
  "name": "@ygn-stem/shared",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schemas": "./src/schemas/index.ts",
    "./errors": "./src/errors.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create shared tsconfig.json**

Write `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create shared vitest.config.ts**

Write `packages/shared/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing test for common schemas**

Write `packages/shared/src/__tests__/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  RequestIdSchema,
  CallerIdSchema,
  TimestampSchema,
  OutcomeSchema,
  type RequestId,
  type CallerId,
} from "../schemas/common.js";

describe("Common schemas", () => {
  it("validates RequestId as UUID v7 format", () => {
    const valid = RequestIdSchema.parse("01912345-6789-7abc-8def-0123456789ab");
    expect(valid).toBeDefined();
  });

  it("rejects empty RequestId", () => {
    expect(() => RequestIdSchema.parse("")).toThrow();
  });

  it("validates CallerId as non-empty string", () => {
    const valid = CallerIdSchema.parse("caller-123");
    expect(valid).toBeDefined();
  });

  it("validates Timestamp as ISO 8601", () => {
    const valid = TimestampSchema.parse("2026-03-27T12:00:00.000Z");
    expect(valid).toBeDefined();
  });

  it("validates Outcome enum", () => {
    expect(OutcomeSchema.parse("success")).toBe("success");
    expect(OutcomeSchema.parse("failure")).toBe("failure");
    expect(OutcomeSchema.parse("partial")).toBe("partial");
    expect(() => OutcomeSchema.parse("invalid")).toThrow();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd packages/shared && pnpm test
```

Expected: FAIL — modules not found.

- [ ] **Step 6: Write common schemas**

Write `packages/shared/src/schemas/common.ts`:

```typescript
import { z } from "zod/v4";

export const RequestIdSchema = z.string().min(1).describe("UUID v7 request correlation ID");
export type RequestId = z.infer<typeof RequestIdSchema>;

export const CallerIdSchema = z.string().min(1).describe("Authenticated caller identifier");
export type CallerId = z.infer<typeof CallerIdSchema>;

export const TimestampSchema = z.string().datetime().describe("ISO 8601 timestamp");
export type Timestamp = z.infer<typeof TimestampSchema>;

export const OutcomeSchema = z.enum(["success", "failure", "partial"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const EmbeddingSchema = z.array(z.number()).describe("Vector embedding");
export type Embedding = z.infer<typeof EmbeddingSchema>;

export const ImportanceScoreSchema = z.number().min(0).max(1).describe("Importance score 0-1");
export type ImportanceScore = z.infer<typeof ImportanceScoreSchema>;

export const ConfidenceSchema = z.number().min(0).max(1).describe("Confidence score 0-1");
export type Confidence = z.infer<typeof ConfidenceSchema>;
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd packages/shared && pnpm test
```

Expected: PASS

- [ ] **Step 8: Write memory schemas with tests**

Write `packages/shared/src/schemas/memory.ts`:

```typescript
import { z } from "zod/v4";
import {
  CallerIdSchema,
  TimestampSchema,
  OutcomeSchema,
  EmbeddingSchema,
  ImportanceScoreSchema,
  ConfidenceSchema,
} from "./common.js";

// --- Facts Network ---
export const FactTripleSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidence: ConfidenceSchema,
  sourceOrgan: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  embedding: EmbeddingSchema.optional(),
});
export type FactTriple = z.infer<typeof FactTripleSchema>;

// --- Experiences Network ---
export const EpisodeSchema = z.object({
  id: z.string().min(1),
  timestamp: TimestampSchema,
  callerId: CallerIdSchema,
  intent: z.string(),
  entities: z.array(z.string()),
  toolsUsed: z.array(z.string()),
  organUsed: z.string().optional(),
  outcome: OutcomeSchema,
  durationMs: z.number().int().nonnegative(),
  importanceScore: ImportanceScoreSchema,
  embedding: EmbeddingSchema.optional(),
});
export type Episode = z.infer<typeof EpisodeSchema>;

// --- Summaries Network ---
export const EntitySummarySchema = z.object({
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  primaryAbstraction: z.string(),
  cueAnchors: z.array(z.string()),
  concreteValues: z.array(z.string()),
  lastUpdated: TimestampSchema,
  version: z.number().int().nonnegative(),
});
export type EntitySummary = z.infer<typeof EntitySummarySchema>;

// --- Beliefs Network ---
export const ProfileDimensionSchema = z.object({
  value: z.number().min(0).max(1),
  confidence: ConfidenceSchema,
  interactionCount: z.number().int().nonnegative(),
});
export type ProfileDimension = z.infer<typeof ProfileDimensionSchema>;

export const CallerProfileSchema = z.object({
  callerId: CallerIdSchema,
  philosophy: z.record(z.string(), ProfileDimensionSchema),
  principles: z.record(z.string(), ProfileDimensionSchema),
  style: z.record(z.string(), ProfileDimensionSchema),
  habits: z.record(z.string(), ProfileDimensionSchema),
  preferredStrategies: z.record(z.string(), z.number()),
  organPreferences: z.record(z.string(), z.number()),
  skillSuccessRates: z.record(z.string(), z.number()),
  lastUpdated: TimestampSchema,
});
export type CallerProfile = z.infer<typeof CallerProfileSchema>;

// --- Memory Operations ---
export const RetainInputSchema = z.object({
  episode: EpisodeSchema,
  extractedTriples: z.array(FactTripleSchema).optional(),
});
export type RetainInput = z.infer<typeof RetainInputSchema>;

export const RecallQuerySchema = z.object({
  query: z.string().min(1),
  callerId: CallerIdSchema,
  limit: z.number().int().positive().default(10),
  networks: z.array(z.enum(["facts", "experiences", "summaries", "beliefs"])).default(["facts", "experiences", "summaries", "beliefs"]),
});
export type RecallQuery = z.infer<typeof RecallQuerySchema>;

export const RecallResultSchema = z.object({
  facts: z.array(FactTripleSchema),
  episodes: z.array(EpisodeSchema),
  summaries: z.array(EntitySummarySchema),
  callerProfile: CallerProfileSchema.optional(),
  scores: z.record(z.string(), z.number()),
});
export type RecallResult = z.infer<typeof RecallResultSchema>;
```

- [ ] **Step 9: Write skill schemas**

Write `packages/shared/src/schemas/skill.ts`:

```typescript
import { z } from "zod/v4";
import { ConfidenceSchema } from "./common.js";

export const SkillMaturitySchema = z.enum(["progenitor", "committed", "mature"]);
export type SkillMaturity = z.infer<typeof SkillMaturitySchema>;

export const SkillSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  triggers: z.array(z.string()),
  maturity: SkillMaturitySchema,
  activations: z.number().int().nonnegative(),
  successRate: ConfidenceSchema,
  organs: z.array(z.string()),
  instructions: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillMatchResultSchema = z.object({
  skill: SkillSchema,
  score: z.number(),
  canShortCircuit: z.boolean(),
});
export type SkillMatchResult = z.infer<typeof SkillMatchResultSchema>;

export const SkillOutcomeSchema = z.object({
  skillName: z.string().min(1),
  success: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  callerId: z.string().min(1),
});
export type SkillOutcome = z.infer<typeof SkillOutcomeSchema>;
```

- [ ] **Step 10: Write organ schemas**

Write `packages/shared/src/schemas/organ.ts`:

```typescript
import { z } from "zod/v4";

export const OrganStatusSchema = z.enum(["connected", "disconnected", "degraded"]);
export type OrganStatus = z.infer<typeof OrganStatusSchema>;

export const TransportTypeSchema = z.enum(["mcp-stdio", "mcp-http", "a2a", "uacp", "cli"]);
export type TransportType = z.infer<typeof TransportTypeSchema>;

export const OrganConfigSchema = z.object({
  name: z.string().min(1),
  transports: z.array(z.object({
    type: TransportTypeSchema,
    uri: z.string(),
    priority: z.number().int().nonnegative().default(0),
  })),
  tools: z.array(z.string()).default([]),
  healthEndpoint: z.string().optional(),
});
export type OrganConfig = z.infer<typeof OrganConfigSchema>;

export const OrganInfoSchema = OrganConfigSchema.extend({
  status: OrganStatusSchema,
  lastSeen: z.string().datetime().optional(),
  toolCount: z.number().int().nonnegative(),
});
export type OrganInfo = z.infer<typeof OrganInfoSchema>;

export const ToolDescriptorSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  organ: z.string().min(1),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
});
export type ToolDescriptor = z.infer<typeof ToolDescriptorSchema>;
```

- [ ] **Step 11: Write protocol schemas**

Write `packages/shared/src/schemas/protocol.ts`:

```typescript
import { z } from "zod/v4";

// --- A2A ---
export const A2ATaskStateSchema = z.enum(["created", "running", "completed", "failed", "cancelled"]);
export type A2ATaskState = z.infer<typeof A2ATaskStateSchema>;

export const A2ATaskSchema = z.object({
  id: z.string().min(1),
  state: A2ATaskStateSchema,
  message: z.string().optional(),
  result: z.unknown().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type A2ATask = z.infer<typeof A2ATaskSchema>;

export const AgentCardSchema = z.object({
  name: z.string(),
  description: z.string(),
  capabilities: z.object({
    streaming: z.boolean().default(true),
    pushNotifications: z.boolean().default(false),
  }),
  skills: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  })),
  interfaces: z.array(z.object({
    protocol: z.string(),
    url: z.string(),
  })),
});
export type AgentCard = z.infer<typeof AgentCardSchema>;

// --- AG-UI Events ---
export const AgUiEventTypeSchema = z.enum([
  "TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END",
  "REASONING_MESSAGE",
  "TOOL_CALL_START", "TOOL_CALL_ARGS", "TOOL_CALL_END",
  "STATE_SNAPSHOT",
  "RUN_STARTED", "RUN_FINISHED", "RUN_ERROR",
]);
export type AgUiEventType = z.infer<typeof AgUiEventTypeSchema>;

export const AgUiEventSchema = z.object({
  type: AgUiEventTypeSchema,
  data: z.unknown(),
  timestamp: z.string().datetime(),
});
export type AgUiEvent = z.infer<typeof AgUiEventSchema>;

// --- JSON-RPC 2.0 ---
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string().min(1),
  params: z.unknown().optional(),
  id: z.union([z.string(), z.number()]).optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  result: z.unknown().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }).optional(),
  id: z.union([z.string(), z.number(), z.null()]),
});
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;
```

- [ ] **Step 12: Write caller schemas**

Write `packages/shared/src/schemas/caller.ts`:

```typescript
import { z } from "zod/v4";

export const TaskPropertySchema = z.object({
  hasSequentialDeps: z.boolean(),
  toolDensity: z.number().int().nonnegative(),
  isParallelizable: z.boolean(),
  complexity: z.enum(["simple", "medium", "complex"]),
  domainCount: z.number().int().positive(),
  intent: z.string(),
});
export type TaskProperty = z.infer<typeof TaskPropertySchema>;

export const ArchitectureChoiceSchema = z.enum([
  "single-agent",
  "centralized-multi-agent",
  "adversarial-redblue",
  "smt-pipeline",
  "knowledge-pipeline",
  "direct-llm",
]);
export type ArchitectureChoice = z.infer<typeof ArchitectureChoiceSchema>;

export const OrganRoutingSchema = z.object({
  architecture: ArchitectureChoiceSchema,
  primaryOrgan: z.string(),
  secondaryOrgans: z.array(z.string()).default([]),
  oversightRequired: z.boolean().default(false),
  evidenceCapture: z.boolean().default(false),
});
export type OrganRouting = z.infer<typeof OrganRoutingSchema>;
```

- [ ] **Step 13: Write schemas index + package index**

Write `packages/shared/src/schemas/index.ts`:

```typescript
export * from "./common.js";
export * from "./memory.js";
export * from "./skill.js";
export * from "./organ.js";
export * from "./protocol.js";
export * from "./caller.js";
```

Write `packages/shared/src/errors.ts`:

```typescript
export class StemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StemError";
  }
}

export class OrganUnavailableError extends StemError {
  constructor(organName: string, cause?: unknown) {
    super(`Organ "${organName}" is unavailable`, "ORGAN_UNAVAILABLE", cause);
    this.name = "OrganUnavailableError";
  }
}

export class CircuitOpenError extends StemError {
  constructor(organName: string) {
    super(`Circuit breaker open for "${organName}"`, "CIRCUIT_OPEN");
    this.name = "CircuitOpenError";
  }
}

export class CallerNotFoundError extends StemError {
  constructor(callerId: string) {
    super(`Caller "${callerId}" not found`, "CALLER_NOT_FOUND");
    this.name = "CallerNotFoundError";
  }
}

export class SkillNotFoundError extends StemError {
  constructor(skillName: string) {
    super(`Skill "${skillName}" not found`, "SKILL_NOT_FOUND");
    this.name = "SkillNotFoundError";
  }
}
```

Write `packages/shared/src/index.ts`:

```typescript
export * from "./schemas/index.js";
export * from "./errors.js";
```

- [ ] **Step 14: Add memory and skill schema tests**

Append to `packages/shared/src/__tests__/schemas.test.ts`:

```typescript
import {
  FactTripleSchema,
  EpisodeSchema,
  EntitySummarySchema,
  CallerProfileSchema,
  SkillSchema,
  SkillMaturitySchema,
  OrganConfigSchema,
  AgentCardSchema,
  JsonRpcRequestSchema,
  TaskPropertySchema,
  ArchitectureChoiceSchema,
} from "../schemas/index.js";

describe("Memory schemas", () => {
  it("validates a FactTriple", () => {
    const triple = FactTripleSchema.parse({
      id: "fact-1",
      subject: "Y-GN",
      predicate: "speaks_protocol",
      object: "MCP",
      confidence: 0.95,
      sourceOrgan: "sage",
      createdAt: "2026-03-27T12:00:00.000Z",
      updatedAt: "2026-03-27T12:00:00.000Z",
    });
    expect(triple.subject).toBe("Y-GN");
  });

  it("validates an Episode", () => {
    const episode = EpisodeSchema.parse({
      id: "ep-1",
      timestamp: "2026-03-27T12:00:00.000Z",
      callerId: "caller-1",
      intent: "code-review",
      entities: ["rust", "unsafe"],
      toolsUsed: ["sage.run_task"],
      organUsed: "sage",
      outcome: "success",
      durationMs: 1500,
      importanceScore: 0.8,
    });
    expect(episode.outcome).toBe("success");
  });

  it("rejects importance score > 1", () => {
    expect(() =>
      EpisodeSchema.parse({
        id: "ep-1",
        timestamp: "2026-03-27T12:00:00.000Z",
        callerId: "c",
        intent: "x",
        entities: [],
        toolsUsed: [],
        outcome: "success",
        durationMs: 0,
        importanceScore: 1.5,
      }),
    ).toThrow();
  });

  it("validates an EntitySummary with cue anchors", () => {
    const summary = EntitySummarySchema.parse({
      entityId: "sage",
      entityType: "organ",
      primaryAbstraction: "Research and topology engine",
      cueAnchors: ["topology", "kNN", "MAP-Elites", "Z3"],
      concreteValues: ["92% kNN accuracy", "6-path engine"],
      lastUpdated: "2026-03-27T12:00:00.000Z",
      version: 1,
    });
    expect(summary.cueAnchors).toHaveLength(4);
  });
});

describe("Skill schemas", () => {
  it("validates a Skill", () => {
    const skill = SkillSchema.parse({
      name: "code-review-rust",
      description: "Review Rust code for safety",
      triggers: ["rust", "review", "unsafe"],
      maturity: "committed",
      activations: 7,
      successRate: 0.85,
      organs: ["sage", "metacog"],
      instructions: "1. Classify\n2. Run\n3. Verify",
      createdAt: "2026-03-27T12:00:00.000Z",
      updatedAt: "2026-03-27T12:00:00.000Z",
    });
    expect(skill.maturity).toBe("committed");
  });

  it("validates maturity lifecycle values", () => {
    expect(SkillMaturitySchema.parse("progenitor")).toBe("progenitor");
    expect(SkillMaturitySchema.parse("committed")).toBe("committed");
    expect(SkillMaturitySchema.parse("mature")).toBe("mature");
    expect(() => SkillMaturitySchema.parse("expired")).toThrow();
  });
});

describe("Organ schemas", () => {
  it("validates an OrganConfig", () => {
    const config = OrganConfigSchema.parse({
      name: "ygn",
      transports: [
        { type: "mcp-stdio", uri: "stdio:ygn-core mcp", priority: 0 },
        { type: "mcp-http", uri: "http://localhost:3000/mcp", priority: 1 },
      ],
    });
    expect(config.transports).toHaveLength(2);
  });
});

describe("Protocol schemas", () => {
  it("validates a JSON-RPC 2.0 request", () => {
    const req = JsonRpcRequestSchema.parse({
      jsonrpc: "2.0",
      method: "tools/list",
      id: 1,
    });
    expect(req.method).toBe("tools/list");
  });

  it("validates an AgentCard", () => {
    const card = AgentCardSchema.parse({
      name: "YGN-STEM",
      description: "Adaptive Agent Fabric",
      capabilities: { streaming: true },
      skills: [{ id: "orchestrate", name: "Orchestrate" }],
      interfaces: [{ protocol: "mcp", url: "/mcp" }],
    });
    expect(card.skills).toHaveLength(1);
  });
});

describe("Caller schemas", () => {
  it("validates TaskProperty", () => {
    const task = TaskPropertySchema.parse({
      hasSequentialDeps: false,
      toolDensity: 3,
      isParallelizable: true,
      complexity: "complex",
      domainCount: 2,
      intent: "multi-domain analysis",
    });
    expect(task.complexity).toBe("complex");
  });

  it("validates ArchitectureChoice", () => {
    expect(ArchitectureChoiceSchema.parse("single-agent")).toBe("single-agent");
    expect(ArchitectureChoiceSchema.parse("adversarial-redblue")).toBe("adversarial-redblue");
    expect(() => ArchitectureChoiceSchema.parse("custom")).toThrow();
  });
});
```

- [ ] **Step 15: Install shared deps and run all tests**

```bash
cd packages/shared && pnpm install && pnpm test
```

Expected: ALL PASS

- [ ] **Step 16: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add Zod v4 schemas for memory, skills, organs, protocols, callers"
```

---

## Phase 2: Connector Infrastructure

### Task 3: Circuit breaker

**Files:**
- Create: `packages/connectors/package.json`
- Create: `packages/connectors/tsconfig.json`
- Create: `packages/connectors/vitest.config.ts`
- Create: `packages/connectors/src/circuit-breaker.ts`
- Test: `packages/connectors/src/__tests__/circuit-breaker.test.ts`

- [ ] **Step 1: Create connectors package scaffold**

Write `packages/connectors/package.json`:

```json
{
  "name": "@ygn-stem/connectors",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@ygn-stem/shared": "workspace:*"
  }
}
```

Write `packages/connectors/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

Write `packages/connectors/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 2: Write failing test for circuit breaker**

Write `packages/connectors/src/__tests__/circuit-breaker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker, CircuitState } from "../circuit-breaker.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 100 });
  });

  it("starts in closed state", () => {
    expect(breaker.state).toBe(CircuitState.Closed);
  });

  it("stays closed on success", async () => {
    const result = await breaker.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(breaker.state).toBe(CircuitState.Closed);
  });

  it("opens after failureThreshold consecutive failures", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }
    expect(breaker.state).toBe(CircuitState.Open);
  });

  it("rejects immediately when open", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }
    await expect(breaker.execute(() => Promise.resolve("ok"))).rejects.toThrow("Circuit breaker is open");
  });

  it("transitions to half-open after resetTimeout", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 150));
    expect(breaker.state).toBe(CircuitState.HalfOpen);
  });

  it("closes on success in half-open state", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 150));
    await breaker.execute(() => Promise.resolve("recovered"));
    expect(breaker.state).toBe(CircuitState.Closed);
  });

  it("re-opens on failure in half-open state", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 150));
    await breaker.execute(fail).catch(() => {});
    expect(breaker.state).toBe(CircuitState.Open);
  });

  it("resets failure count on success", async () => {
    const fail = () => Promise.reject(new Error("fail"));
    await breaker.execute(fail).catch(() => {});
    await breaker.execute(fail).catch(() => {});
    await breaker.execute(() => Promise.resolve("ok"));
    expect(breaker.state).toBe(CircuitState.Closed);
    // One more failure should not open (count was reset)
    await breaker.execute(fail).catch(() => {});
    expect(breaker.state).toBe(CircuitState.Closed);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/connectors && pnpm install && pnpm test
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement circuit breaker**

Write `packages/connectors/src/circuit-breaker.ts`:

```typescript
export enum CircuitState {
  Closed = "closed",
  Open = "open",
  HalfOpen = "half_open",
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export class CircuitBreaker {
  private _state = CircuitState.Closed;
  private failures = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeoutMs: options.resetTimeoutMs ?? 30_000,
    };
  }

  get state(): CircuitState {
    if (
      this._state === CircuitState.Open &&
      Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs
    ) {
      this._state = CircuitState.HalfOpen;
    }
    return this._state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.Open) {
      throw new Error("Circuit breaker is open");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this._state = CircuitState.Closed;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this._state === CircuitState.HalfOpen || this.failures >= this.options.failureThreshold) {
      this._state = CircuitState.Open;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/connectors && pnpm test
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/connectors/
git commit -m "feat(connectors): add 3-state circuit breaker with configurable threshold"
```

---

### Task 4: Base connector + Organ registry

**Files:**
- Create: `packages/connectors/src/base-connector.ts`
- Create: `packages/connectors/src/organ-registry.ts`
- Create: `packages/connectors/src/index.ts`
- Test: `packages/connectors/src/__tests__/organ-registry.test.ts`

- [ ] **Step 1: Write failing test for organ registry**

Write `packages/connectors/src/__tests__/organ-registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { OrganRegistry } from "../organ-registry.js";
import { BaseConnector } from "../base-connector.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import type { OrganConfig, ToolDescriptor } from "@ygn-stem/shared";

class MockConnector extends BaseConnector {
  async doConnect(): Promise<void> {}
  async doDisconnect(): Promise<void> {}
  async doCallTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return { tool: name, args };
  }
  async doHealth(): Promise<boolean> {
    return true;
  }
  async doListTools(): Promise<ToolDescriptor[]> {
    return [
      { name: "mock.echo", description: "Echo tool", organ: this.config.name },
      { name: "mock.ping", description: "Ping tool", organ: this.config.name },
    ];
  }
}

describe("OrganRegistry", () => {
  let registry: OrganRegistry;
  const mockConfig: OrganConfig = {
    name: "mock",
    transports: [{ type: "mcp-http", uri: "http://localhost:9999/mcp", priority: 0 }],
    tools: [],
  };

  beforeEach(() => {
    registry = new OrganRegistry();
  });

  it("registers an organ and lists it", async () => {
    const connector = new MockConnector(mockConfig);
    await registry.register(connector);
    const organs = registry.list();
    expect(organs).toHaveLength(1);
    expect(organs[0]!.name).toBe("mock");
  });

  it("deregisters an organ", async () => {
    const connector = new MockConnector(mockConfig);
    await registry.register(connector);
    await registry.deregister("mock");
    expect(registry.list()).toHaveLength(0);
  });

  it("calls a tool through the registry", async () => {
    const connector = new MockConnector(mockConfig);
    await registry.register(connector);
    const result = await registry.callTool("mock.echo", { text: "hello" });
    expect(result).toEqual({ tool: "mock.echo", args: { text: "hello" } });
  });

  it("throws on unknown tool", async () => {
    await expect(registry.callTool("unknown.tool", {})).rejects.toThrow();
  });

  it("aggregates tools from all organs", async () => {
    const connector = new MockConnector(mockConfig);
    await registry.register(connector);
    const tools = registry.allTools();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toContain("mock.echo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/connectors && pnpm test
```

Expected: FAIL

- [ ] **Step 3: Implement base connector**

Write `packages/connectors/src/base-connector.ts`:

```typescript
import type { OrganConfig, OrganInfo, OrganStatus, ToolDescriptor } from "@ygn-stem/shared";
import { CircuitBreaker } from "./circuit-breaker.js";

export abstract class BaseConnector {
  readonly config: OrganConfig;
  protected readonly circuitBreaker: CircuitBreaker;
  private _status: OrganStatus = "disconnected";
  private _tools: ToolDescriptor[] = [];

  constructor(config: OrganConfig, circuitBreakerOptions?: { failureThreshold?: number; resetTimeoutMs?: number }) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
  }

  get status(): OrganStatus {
    return this._status;
  }

  get tools(): ToolDescriptor[] {
    return this._tools;
  }

  async connect(): Promise<void> {
    await this.doConnect();
    this._tools = await this.doListTools();
    this._status = "connected";
  }

  async disconnect(): Promise<void> {
    await this.doDisconnect();
    this._status = "disconnected";
    this._tools = [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.circuitBreaker.execute(() => this.doCallTool(name, args));
  }

  async health(): Promise<boolean> {
    try {
      const healthy = await this.doHealth();
      this._status = healthy ? "connected" : "degraded";
      return healthy;
    } catch {
      this._status = "degraded";
      return false;
    }
  }

  info(): OrganInfo {
    return {
      ...this.config,
      status: this._status,
      lastSeen: new Date().toISOString(),
      toolCount: this._tools.length,
    };
  }

  protected abstract doConnect(): Promise<void>;
  protected abstract doDisconnect(): Promise<void>;
  protected abstract doCallTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  protected abstract doHealth(): Promise<boolean>;
  protected abstract doListTools(): Promise<ToolDescriptor[]>;
}
```

- [ ] **Step 4: Implement organ registry**

Write `packages/connectors/src/organ-registry.ts`:

```typescript
import type { OrganInfo, ToolDescriptor } from "@ygn-stem/shared";
import { OrganUnavailableError } from "@ygn-stem/shared";
import type { BaseConnector } from "./base-connector.js";

export class OrganRegistry {
  private readonly organs = new Map<string, BaseConnector>();
  private readonly toolIndex = new Map<string, string>();

  async register(connector: BaseConnector): Promise<void> {
    await connector.connect();
    this.organs.set(connector.config.name, connector);
    for (const tool of connector.tools) {
      this.toolIndex.set(tool.name, connector.config.name);
    }
  }

  async deregister(name: string): Promise<void> {
    const connector = this.organs.get(name);
    if (connector) {
      for (const tool of connector.tools) {
        this.toolIndex.delete(tool.name);
      }
      await connector.disconnect();
      this.organs.delete(name);
    }
  }

  get(name: string): BaseConnector | undefined {
    return this.organs.get(name);
  }

  list(): OrganInfo[] {
    return Array.from(this.organs.values()).map((c) => c.info());
  }

  allTools(): ToolDescriptor[] {
    return Array.from(this.organs.values()).flatMap((c) => c.tools);
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const organName = this.toolIndex.get(toolName);
    if (!organName) {
      throw new OrganUnavailableError(`No organ provides tool "${toolName}"`);
    }
    const connector = this.organs.get(organName);
    if (!connector) {
      throw new OrganUnavailableError(organName);
    }
    return connector.callTool(toolName, args);
  }

  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const [name, connector] of this.organs) {
      results.set(name, await connector.health());
    }
    return results;
  }
}
```

- [ ] **Step 5: Write connectors index**

Write `packages/connectors/src/index.ts`:

```typescript
export { CircuitBreaker, CircuitState, type CircuitBreakerOptions } from "./circuit-breaker.js";
export { BaseConnector } from "./base-connector.js";
export { OrganRegistry } from "./organ-registry.js";
```

- [ ] **Step 6: Run tests to verify all pass**

```bash
cd packages/connectors && pnpm test
```

Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add packages/connectors/
git commit -m "feat(connectors): add BaseConnector ABC and OrganRegistry with tool aggregation"
```

---

## Phase 3: Hindsight Memory

### Task 5: Database schema + Drizzle setup

**Files:**
- Create: `packages/memory/package.json`
- Create: `packages/memory/tsconfig.json`
- Create: `packages/memory/vitest.config.ts`
- Create: `packages/memory/src/db/schema.ts`
- Create: `packages/memory/src/db/connection.ts`
- Create: `packages/memory/drizzle.config.ts`
- Test: `packages/memory/src/__tests__/schema.test.ts`

- [ ] **Step 1: Create memory package scaffold**

Write `packages/memory/package.json`:

```json
{
  "name": "@ygn-stem/memory",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@ygn-stem/shared": "workspace:*",
    "drizzle-orm": "latest",
    "postgres": "^3.4.0",
    "ioredis": "^5.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "latest"
  }
}
```

Write `packages/memory/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

Write `packages/memory/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 2: Write Drizzle schema for all 4 networks**

Write `packages/memory/src/db/schema.ts`:

```typescript
import {
  pgTable,
  text,
  real,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

// --- Facts Network ---
export const facts = pgTable(
  "facts",
  {
    id: text("id").primaryKey(),
    subject: text("subject").notNull(),
    predicate: text("predicate").notNull(),
    object: text("object").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    sourceOrgan: text("source_organ"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    embedding: vector("embedding", { dimensions: 768 }),
  },
  (table) => [
    index("facts_subject_idx").on(table.subject),
    index("facts_predicate_idx").on(table.predicate),
  ],
);

// --- Experiences Network ---
export const episodes = pgTable(
  "episodes",
  {
    id: text("id").primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    callerId: text("caller_id").notNull(),
    intent: text("intent").notNull(),
    entities: jsonb("entities").$type<string[]>().notNull().default([]),
    toolsUsed: jsonb("tools_used").$type<string[]>().notNull().default([]),
    organUsed: text("organ_used"),
    outcome: text("outcome").notNull(), // success | failure | partial
    durationMs: integer("duration_ms").notNull().default(0),
    importanceScore: real("importance_score").notNull().default(0.5),
    embedding: vector("embedding", { dimensions: 768 }),
  },
  (table) => [
    index("episodes_caller_idx").on(table.callerId),
    index("episodes_timestamp_idx").on(table.timestamp),
    index("episodes_outcome_idx").on(table.outcome),
  ],
);

// --- Summaries Network ---
export const summaries = pgTable(
  "summaries",
  {
    entityId: text("entity_id").primaryKey(),
    entityType: text("entity_type").notNull(),
    primaryAbstraction: text("primary_abstraction").notNull(),
    cueAnchors: jsonb("cue_anchors").$type<string[]>().notNull().default([]),
    concreteValues: jsonb("concrete_values").$type<string[]>().notNull().default([]),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(0),
  },
  (table) => [
    index("summaries_type_idx").on(table.entityType),
  ],
);

// --- Beliefs Network ---
export const callerProfiles = pgTable(
  "caller_profiles",
  {
    callerId: text("caller_id").primaryKey(),
    philosophy: jsonb("philosophy").$type<Record<string, { value: number; confidence: number; interactionCount: number }>>().notNull().default({}),
    principles: jsonb("principles").$type<Record<string, { value: number; confidence: number; interactionCount: number }>>().notNull().default({}),
    style: jsonb("style").$type<Record<string, { value: number; confidence: number; interactionCount: number }>>().notNull().default({}),
    habits: jsonb("habits").$type<Record<string, { value: number; confidence: number; interactionCount: number }>>().notNull().default({}),
    preferredStrategies: jsonb("preferred_strategies").$type<Record<string, number>>().notNull().default({}),
    organPreferences: jsonb("organ_preferences").$type<Record<string, number>>().notNull().default({}),
    skillSuccessRates: jsonb("skill_success_rates").$type<Record<string, number>>().notNull().default({}),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  },
);

// --- Skills Registry ---
export const skills = pgTable(
  "skills",
  {
    name: text("name").primaryKey(),
    description: text("description").notNull(),
    triggers: jsonb("triggers").$type<string[]>().notNull().default([]),
    maturity: text("maturity").notNull().default("progenitor"), // progenitor | committed | mature
    activations: integer("activations").notNull().default(0),
    successRate: real("success_rate").notNull().default(0),
    organs: jsonb("organs").$type<string[]>().notNull().default([]),
    instructions: text("instructions").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("skills_maturity_idx").on(table.maturity),
  ],
);
```

- [ ] **Step 3: Write DB connection factory**

Write `packages/memory/src/db/connection.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

- [ ] **Step 4: Write schema validation test**

Write `packages/memory/src/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { facts, episodes, summaries, callerProfiles, skills } from "../db/schema.js";

describe("Database schema", () => {
  it("facts table has expected columns", () => {
    expect(facts.id).toBeDefined();
    expect(facts.subject).toBeDefined();
    expect(facts.predicate).toBeDefined();
    expect(facts.object).toBeDefined();
    expect(facts.confidence).toBeDefined();
    expect(facts.embedding).toBeDefined();
  });

  it("episodes table has expected columns", () => {
    expect(episodes.id).toBeDefined();
    expect(episodes.callerId).toBeDefined();
    expect(episodes.intent).toBeDefined();
    expect(episodes.outcome).toBeDefined();
    expect(episodes.importanceScore).toBeDefined();
    expect(episodes.embedding).toBeDefined();
  });

  it("summaries table has cue anchors column", () => {
    expect(summaries.entityId).toBeDefined();
    expect(summaries.cueAnchors).toBeDefined();
    expect(summaries.primaryAbstraction).toBeDefined();
  });

  it("callerProfiles table has 4 dimension categories", () => {
    expect(callerProfiles.philosophy).toBeDefined();
    expect(callerProfiles.principles).toBeDefined();
    expect(callerProfiles.style).toBeDefined();
    expect(callerProfiles.habits).toBeDefined();
  });

  it("skills table has maturity lifecycle columns", () => {
    expect(skills.name).toBeDefined();
    expect(skills.maturity).toBeDefined();
    expect(skills.activations).toBeDefined();
    expect(skills.successRate).toBeDefined();
    expect(skills.triggers).toBeDefined();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd packages/memory && pnpm install && pnpm test
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/memory/
git commit -m "feat(memory): add Drizzle schema for Hindsight 4-network + skills registry"
```

---

### Task 6: Facts network store

**Files:**
- Create: `packages/memory/src/networks/facts-store.ts`
- Test: `packages/memory/src/__tests__/facts-store.test.ts`

- [ ] **Step 1: Write failing test for facts store (in-memory for unit tests)**

Write `packages/memory/src/__tests__/facts-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryFactsStore } from "../networks/facts-store.js";
import type { FactTriple } from "@ygn-stem/shared";

const makeFact = (overrides: Partial<FactTriple> = {}): FactTriple => ({
  id: `fact-${Math.random().toString(36).slice(2, 8)}`,
  subject: "Y-GN",
  predicate: "speaks_protocol",
  object: "MCP",
  confidence: 0.95,
  sourceOrgan: "test",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("InMemoryFactsStore", () => {
  let store: InMemoryFactsStore;

  beforeEach(() => {
    store = new InMemoryFactsStore();
  });

  it("stores and retrieves a fact by id", async () => {
    const fact = makeFact({ id: "f1" });
    await store.upsert(fact);
    const retrieved = await store.getById("f1");
    expect(retrieved?.subject).toBe("Y-GN");
  });

  it("returns undefined for unknown id", async () => {
    expect(await store.getById("unknown")).toBeUndefined();
  });

  it("searches by subject", async () => {
    await store.upsert(makeFact({ subject: "Y-GN" }));
    await store.upsert(makeFact({ subject: "SAGE" }));
    const results = await store.search({ subject: "Y-GN" });
    expect(results).toHaveLength(1);
    expect(results[0]!.subject).toBe("Y-GN");
  });

  it("deduplicates on matching subject+predicate+object", async () => {
    await store.upsert(makeFact({ id: "f1", subject: "A", predicate: "B", object: "C", confidence: 0.5 }));
    await store.upsert(makeFact({ id: "f2", subject: "A", predicate: "B", object: "C", confidence: 0.9 }));
    const all = await store.search({});
    expect(all).toHaveLength(1);
    expect(all[0]!.confidence).toBe(0.9);
  });

  it("deletes a fact", async () => {
    await store.upsert(makeFact({ id: "f1" }));
    await store.delete("f1");
    expect(await store.getById("f1")).toBeUndefined();
  });

  it("counts facts", async () => {
    await store.upsert(makeFact({ id: "f1" }));
    await store.upsert(makeFact({ id: "f2" }));
    expect(await store.count()).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/memory && pnpm test
```

Expected: FAIL

- [ ] **Step 3: Implement in-memory facts store**

Write `packages/memory/src/networks/facts-store.ts`:

```typescript
import type { FactTriple } from "@ygn-stem/shared";

export interface IFactsStore {
  upsert(fact: FactTriple): Promise<void>;
  getById(id: string): Promise<FactTriple | undefined>;
  search(filter: { subject?: string; predicate?: string; object?: string }): Promise<FactTriple[]>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

export class InMemoryFactsStore implements IFactsStore {
  private readonly facts = new Map<string, FactTriple>();
  private readonly tripleIndex = new Map<string, string>();

  private tripleKey(f: FactTriple): string {
    return `${f.subject}::${f.predicate}::${f.object}`;
  }

  async upsert(fact: FactTriple): Promise<void> {
    const key = this.tripleKey(fact);
    const existingId = this.tripleIndex.get(key);

    if (existingId && existingId !== fact.id) {
      const existing = this.facts.get(existingId);
      if (existing && fact.confidence > existing.confidence) {
        this.facts.delete(existingId);
        this.facts.set(fact.id, fact);
        this.tripleIndex.set(key, fact.id);
      }
      return;
    }

    this.facts.set(fact.id, fact);
    this.tripleIndex.set(key, fact.id);
  }

  async getById(id: string): Promise<FactTriple | undefined> {
    return this.facts.get(id);
  }

  async search(filter: { subject?: string; predicate?: string; object?: string }): Promise<FactTriple[]> {
    return Array.from(this.facts.values()).filter((f) => {
      if (filter.subject && f.subject !== filter.subject) return false;
      if (filter.predicate && f.predicate !== filter.predicate) return false;
      if (filter.object && f.object !== filter.object) return false;
      return true;
    });
  }

  async delete(id: string): Promise<void> {
    const fact = this.facts.get(id);
    if (fact) {
      this.tripleIndex.delete(this.tripleKey(fact));
      this.facts.delete(id);
    }
  }

  async count(): Promise<number> {
    return this.facts.size;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/memory && pnpm test
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/memory/src/networks/ packages/memory/src/__tests__/facts-store.test.ts
git commit -m "feat(memory): add Facts network store with deduplication"
```

---

### Task 7: Experiences network store

**Files:**
- Create: `packages/memory/src/networks/episodes-store.ts`
- Test: `packages/memory/src/__tests__/episodes-store.test.ts`

- [ ] **Step 1: Write failing test**

Write `packages/memory/src/__tests__/episodes-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryEpisodesStore } from "../networks/episodes-store.js";
import type { Episode } from "@ygn-stem/shared";

const makeEpisode = (overrides: Partial<Episode> = {}): Episode => ({
  id: `ep-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: new Date().toISOString(),
  callerId: "caller-1",
  intent: "code-review",
  entities: ["rust"],
  toolsUsed: ["sage.run_task"],
  organUsed: "sage",
  outcome: "success",
  durationMs: 1500,
  importanceScore: 0.8,
  ...overrides,
});

describe("InMemoryEpisodesStore", () => {
  let store: InMemoryEpisodesStore;

  beforeEach(() => {
    store = new InMemoryEpisodesStore();
  });

  it("stores and retrieves an episode", async () => {
    const ep = makeEpisode({ id: "ep-1" });
    await store.store(ep);
    const retrieved = await store.getById("ep-1");
    expect(retrieved?.intent).toBe("code-review");
  });

  it("searches by callerId", async () => {
    await store.store(makeEpisode({ callerId: "alice" }));
    await store.store(makeEpisode({ callerId: "bob" }));
    const results = await store.searchByCaller("alice");
    expect(results).toHaveLength(1);
  });

  it("searches by intent keyword", async () => {
    await store.store(makeEpisode({ intent: "code-review" }));
    await store.store(makeEpisode({ intent: "deploy" }));
    const results = await store.searchByKeyword("review");
    expect(results).toHaveLength(1);
  });

  it("prunes episodes below importance threshold", async () => {
    await store.store(makeEpisode({ id: "low", importanceScore: 0.1 }));
    await store.store(makeEpisode({ id: "high", importanceScore: 0.9 }));
    const pruned = await store.pruneBelow(0.5);
    expect(pruned).toBe(1);
    expect(await store.getById("low")).toBeUndefined();
    expect(await store.getById("high")).toBeDefined();
  });

  it("computes importance score", () => {
    const score = InMemoryEpisodesStore.computeImportance({
      novelty: 0.8,
      outcomeSignificance: 0.6,
      callerRarity: 0.4,
      toolCount: 3,
    });
    // 0.3*0.8 + 0.3*0.6 + 0.2*0.4 + 0.2*min(1, 3/5) = 0.24 + 0.18 + 0.08 + 0.12 = 0.62
    expect(score).toBeCloseTo(0.62, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/memory && pnpm test
```

Expected: FAIL

- [ ] **Step 3: Implement episodes store**

Write `packages/memory/src/networks/episodes-store.ts`:

```typescript
import type { Episode } from "@ygn-stem/shared";

export interface IEpisodesStore {
  store(episode: Episode): Promise<void>;
  getById(id: string): Promise<Episode | undefined>;
  searchByCaller(callerId: string, limit?: number): Promise<Episode[]>;
  searchByKeyword(keyword: string, limit?: number): Promise<Episode[]>;
  pruneBelow(importanceThreshold: number): Promise<number>;
  count(): Promise<number>;
}

export class InMemoryEpisodesStore implements IEpisodesStore {
  private readonly episodes = new Map<string, Episode>();

  static computeImportance(signals: {
    novelty: number;
    outcomeSignificance: number;
    callerRarity: number;
    toolCount: number;
  }): number {
    return (
      0.3 * signals.novelty +
      0.3 * signals.outcomeSignificance +
      0.2 * signals.callerRarity +
      0.2 * Math.min(1, signals.toolCount / 5)
    );
  }

  async store(episode: Episode): Promise<void> {
    this.episodes.set(episode.id, episode);
  }

  async getById(id: string): Promise<Episode | undefined> {
    return this.episodes.get(id);
  }

  async searchByCaller(callerId: string, limit = 10): Promise<Episode[]> {
    return Array.from(this.episodes.values())
      .filter((e) => e.callerId === callerId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  async searchByKeyword(keyword: string, limit = 10): Promise<Episode[]> {
    const lower = keyword.toLowerCase();
    return Array.from(this.episodes.values())
      .filter(
        (e) =>
          e.intent.toLowerCase().includes(lower) ||
          e.entities.some((ent) => ent.toLowerCase().includes(lower)),
      )
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, limit);
  }

  async pruneBelow(importanceThreshold: number): Promise<number> {
    let pruned = 0;
    for (const [id, episode] of this.episodes) {
      if (episode.importanceScore < importanceThreshold) {
        this.episodes.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  async count(): Promise<number> {
    return this.episodes.size;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/memory && pnpm test
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/memory/src/networks/episodes-store.ts packages/memory/src/__tests__/episodes-store.test.ts
git commit -m "feat(memory): add Experiences network store with importance scoring and pruning"
```

---

### Task 8: Summaries network store

**Files:**
- Create: `packages/memory/src/networks/summaries-store.ts`
- Test: `packages/memory/src/__tests__/summaries-store.test.ts`

- [ ] **Step 1: Write failing test**

Write `packages/memory/src/__tests__/summaries-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySummariesStore } from "../networks/summaries-store.js";
import type { EntitySummary } from "@ygn-stem/shared";

const makeSummary = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  entityId: "sage",
  entityType: "organ",
  primaryAbstraction: "Research engine",
  cueAnchors: ["topology", "kNN"],
  concreteValues: ["92% accuracy"],
  lastUpdated: new Date().toISOString(),
  version: 0,
  ...overrides,
});

describe("InMemorySummariesStore", () => {
  let store: InMemorySummariesStore;

  beforeEach(() => {
    store = new InMemorySummariesStore();
  });

  it("stores and retrieves a summary", async () => {
    await store.upsert(makeSummary());
    const result = await store.getById("sage");
    expect(result?.primaryAbstraction).toBe("Research engine");
  });

  it("increments version on update", async () => {
    await store.upsert(makeSummary({ version: 0 }));
    await store.upsert(makeSummary({ primaryAbstraction: "Updated engine", version: 0 }));
    const result = await store.getById("sage");
    expect(result?.version).toBe(1);
    expect(result?.primaryAbstraction).toBe("Updated engine");
  });

  it("searches by cue anchor", async () => {
    await store.upsert(makeSummary({ entityId: "sage", cueAnchors: ["topology", "kNN"] }));
    await store.upsert(makeSummary({ entityId: "ygn", cueAnchors: ["swarm", "MCP"] }));
    const results = await store.searchByCueAnchor("topology");
    expect(results).toHaveLength(1);
    expect(results[0]!.entityId).toBe("sage");
  });

  it("searches by entity type", async () => {
    await store.upsert(makeSummary({ entityId: "sage", entityType: "organ" }));
    await store.upsert(makeSummary({ entityId: "rust", entityType: "language" }));
    const results = await store.searchByType("organ");
    expect(results).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, verify fail, implement, run test, verify pass**

Write `packages/memory/src/networks/summaries-store.ts`:

```typescript
import type { EntitySummary } from "@ygn-stem/shared";

export interface ISummariesStore {
  upsert(summary: EntitySummary): Promise<void>;
  getById(entityId: string): Promise<EntitySummary | undefined>;
  searchByCueAnchor(anchor: string): Promise<EntitySummary[]>;
  searchByType(entityType: string): Promise<EntitySummary[]>;
  count(): Promise<number>;
}

export class InMemorySummariesStore implements ISummariesStore {
  private readonly summaries = new Map<string, EntitySummary>();

  async upsert(summary: EntitySummary): Promise<void> {
    const existing = this.summaries.get(summary.entityId);
    if (existing) {
      this.summaries.set(summary.entityId, {
        ...summary,
        version: existing.version + 1,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      this.summaries.set(summary.entityId, summary);
    }
  }

  async getById(entityId: string): Promise<EntitySummary | undefined> {
    return this.summaries.get(entityId);
  }

  async searchByCueAnchor(anchor: string): Promise<EntitySummary[]> {
    const lower = anchor.toLowerCase();
    return Array.from(this.summaries.values()).filter((s) =>
      s.cueAnchors.some((a) => a.toLowerCase().includes(lower)),
    );
  }

  async searchByType(entityType: string): Promise<EntitySummary[]> {
    return Array.from(this.summaries.values()).filter((s) => s.entityType === entityType);
  }

  async count(): Promise<number> {
    return this.summaries.size;
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd packages/memory && pnpm test
```

Expected: ALL PASS

```bash
git add packages/memory/src/networks/summaries-store.ts packages/memory/src/__tests__/summaries-store.test.ts
git commit -m "feat(memory): add Summaries network store with cue anchor search (Memora)"
```

---

### Task 9: Beliefs network store

**Files:**
- Create: `packages/memory/src/networks/beliefs-store.ts`
- Test: `packages/memory/src/__tests__/beliefs-store.test.ts`

- [ ] **Step 1: Write failing test**

Write `packages/memory/src/__tests__/beliefs-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryBeliefsStore } from "../networks/beliefs-store.js";
import type { CallerProfile } from "@ygn-stem/shared";

const makeProfile = (callerId: string): CallerProfile => ({
  callerId,
  philosophy: {
    risk_tolerance: { value: 0.7, confidence: 0.5, interactionCount: 5 },
  },
  principles: {},
  style: {
    verbosity_preference: { value: 0.3, confidence: 0.4, interactionCount: 4 },
  },
  habits: {},
  preferredStrategies: {},
  organPreferences: {},
  skillSuccessRates: {},
  lastUpdated: new Date().toISOString(),
});

describe("InMemoryBeliefsStore", () => {
  let store: InMemoryBeliefsStore;

  beforeEach(() => {
    store = new InMemoryBeliefsStore();
  });

  it("stores and retrieves a caller profile", async () => {
    await store.upsert(makeProfile("alice"));
    const profile = await store.getById("alice");
    expect(profile?.philosophy.risk_tolerance?.value).toBe(0.7);
  });

  it("computes confidence gating", () => {
    // conf(n) = n / (n + κ), κ=10
    expect(InMemoryBeliefsStore.confidenceGate(0)).toBe(0);
    expect(InMemoryBeliefsStore.confidenceGate(5)).toBeCloseTo(1 / 3, 2);
    expect(InMemoryBeliefsStore.confidenceGate(10)).toBe(0.5);
    expect(InMemoryBeliefsStore.confidenceGate(100)).toBeCloseTo(100 / 110, 4);
  });

  it("performs GDPR forget-me (purge by callerId)", async () => {
    await store.upsert(makeProfile("alice"));
    await store.upsert(makeProfile("bob"));
    await store.forgetCaller("alice");
    expect(await store.getById("alice")).toBeUndefined();
    expect(await store.getById("bob")).toBeDefined();
  });

  it("lists all caller IDs", async () => {
    await store.upsert(makeProfile("alice"));
    await store.upsert(makeProfile("bob"));
    const ids = await store.listCallerIds();
    expect(ids).toContain("alice");
    expect(ids).toContain("bob");
  });
});
```

- [ ] **Step 2: Implement beliefs store**

Write `packages/memory/src/networks/beliefs-store.ts`:

```typescript
import type { CallerProfile } from "@ygn-stem/shared";

export interface IBeliefsStore {
  upsert(profile: CallerProfile): Promise<void>;
  getById(callerId: string): Promise<CallerProfile | undefined>;
  forgetCaller(callerId: string): Promise<void>;
  listCallerIds(): Promise<string[]>;
  count(): Promise<number>;
}

const KAPPA = 10;

export class InMemoryBeliefsStore implements IBeliefsStore {
  private readonly profiles = new Map<string, CallerProfile>();

  static confidenceGate(interactionCount: number): number {
    return interactionCount / (interactionCount + KAPPA);
  }

  async upsert(profile: CallerProfile): Promise<void> {
    this.profiles.set(profile.callerId, {
      ...profile,
      lastUpdated: new Date().toISOString(),
    });
  }

  async getById(callerId: string): Promise<CallerProfile | undefined> {
    return this.profiles.get(callerId);
  }

  async forgetCaller(callerId: string): Promise<void> {
    this.profiles.delete(callerId);
  }

  async listCallerIds(): Promise<string[]> {
    return Array.from(this.profiles.keys());
  }

  async count(): Promise<number> {
    return this.profiles.size;
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd packages/memory && pnpm test
```

Expected: ALL PASS

```bash
git add packages/memory/src/networks/beliefs-store.ts packages/memory/src/__tests__/beliefs-store.test.ts
git commit -m "feat(memory): add Beliefs network store with confidence gating and GDPR forget-me"
```

---

### Task 10: Hindsight Memory Manager (Retain + Recall + Reflect)

**Files:**
- Create: `packages/memory/src/hindsight.ts`
- Create: `packages/memory/src/index.ts`
- Test: `packages/memory/src/__tests__/hindsight.test.ts`

- [ ] **Step 1: Write failing test for the unified memory manager**

Write `packages/memory/src/__tests__/hindsight.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { HindsightMemory } from "../hindsight.js";
import { InMemoryFactsStore } from "../networks/facts-store.js";
import { InMemoryEpisodesStore } from "../networks/episodes-store.js";
import { InMemorySummariesStore } from "../networks/summaries-store.js";
import { InMemoryBeliefsStore } from "../networks/beliefs-store.js";
import type { Episode, FactTriple } from "@ygn-stem/shared";

describe("HindsightMemory", () => {
  let memory: HindsightMemory;

  beforeEach(() => {
    memory = new HindsightMemory({
      facts: new InMemoryFactsStore(),
      episodes: new InMemoryEpisodesStore(),
      summaries: new InMemorySummariesStore(),
      beliefs: new InMemoryBeliefsStore(),
    });
  });

  it("RETAIN: stores an episode and optional triples", async () => {
    const episode: Episode = {
      id: "ep-1",
      timestamp: new Date().toISOString(),
      callerId: "alice",
      intent: "code-review",
      entities: ["rust"],
      toolsUsed: ["sage.run_task"],
      organUsed: "sage",
      outcome: "success",
      durationMs: 1500,
      importanceScore: 0.8,
    };
    const triples: FactTriple[] = [
      {
        id: "f-1",
        subject: "sage",
        predicate: "handled",
        object: "code-review",
        confidence: 0.9,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await memory.retain({ episode, extractedTriples: triples });

    expect(await memory.episodes.getById("ep-1")).toBeDefined();
    expect(await memory.facts.getById("f-1")).toBeDefined();
  });

  it("RECALL: retrieves across networks", async () => {
    const episode: Episode = {
      id: "ep-1",
      timestamp: new Date().toISOString(),
      callerId: "alice",
      intent: "code-review",
      entities: ["rust"],
      toolsUsed: [],
      outcome: "success",
      durationMs: 100,
      importanceScore: 0.8,
    };
    await memory.retain({ episode });

    const result = await memory.recall({
      query: "code-review",
      callerId: "alice",
      limit: 10,
      networks: ["experiences"],
    });
    expect(result.episodes).toHaveLength(1);
  });

  it("REFLECT: prunes low-importance episodes", async () => {
    await memory.retain({
      episode: {
        id: "low",
        timestamp: new Date().toISOString(),
        callerId: "alice",
        intent: "trivial",
        entities: [],
        toolsUsed: [],
        outcome: "success",
        durationMs: 50,
        importanceScore: 0.1,
      },
    });
    await memory.retain({
      episode: {
        id: "high",
        timestamp: new Date().toISOString(),
        callerId: "alice",
        intent: "important",
        entities: [],
        toolsUsed: [],
        outcome: "success",
        durationMs: 1000,
        importanceScore: 0.9,
      },
    });
    const stats = await memory.reflect({ importanceThreshold: 0.5 });
    expect(stats.episodesPruned).toBe(1);
    expect(await memory.episodes.getById("low")).toBeUndefined();
    expect(await memory.episodes.getById("high")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement HindsightMemory**

Write `packages/memory/src/hindsight.ts`:

```typescript
import type { Episode, FactTriple, RecallQuery, RecallResult, RetainInput } from "@ygn-stem/shared";
import type { IFactsStore } from "./networks/facts-store.js";
import type { IEpisodesStore } from "./networks/episodes-store.js";
import type { ISummariesStore } from "./networks/summaries-store.js";
import type { IBeliefsStore } from "./networks/beliefs-store.js";

export interface HindsightStores {
  facts: IFactsStore;
  episodes: IEpisodesStore;
  summaries: ISummariesStore;
  beliefs: IBeliefsStore;
}

export interface ReflectOptions {
  importanceThreshold?: number;
}

export interface ReflectStats {
  episodesPruned: number;
  factsDeduped: number;
}

export class HindsightMemory {
  readonly facts: IFactsStore;
  readonly episodes: IEpisodesStore;
  readonly summaries: ISummariesStore;
  readonly beliefs: IBeliefsStore;

  constructor(stores: HindsightStores) {
    this.facts = stores.facts;
    this.episodes = stores.episodes;
    this.summaries = stores.summaries;
    this.beliefs = stores.beliefs;
  }

  async retain(input: RetainInput): Promise<void> {
    await this.episodes.store(input.episode);
    if (input.extractedTriples) {
      for (const triple of input.extractedTriples) {
        await this.facts.upsert(triple);
      }
    }
  }

  async recall(query: RecallQuery): Promise<RecallResult> {
    const result: RecallResult = {
      facts: [],
      episodes: [],
      summaries: [],
      callerProfile: undefined,
      scores: {},
    };

    const networks = query.networks ?? ["facts", "experiences", "summaries", "beliefs"];

    if (networks.includes("facts")) {
      result.facts = await this.facts.search({});
    }

    if (networks.includes("experiences")) {
      result.episodes = await this.episodes.searchByKeyword(query.query, query.limit);
    }

    if (networks.includes("summaries")) {
      result.summaries = await this.summaries.searchByCueAnchor(query.query);
    }

    if (networks.includes("beliefs")) {
      result.callerProfile = await this.beliefs.getById(query.callerId) ?? undefined;
    }

    return result;
  }

  async reflect(options: ReflectOptions = {}): Promise<ReflectStats> {
    const threshold = options.importanceThreshold ?? 0.3;
    const episodesPruned = await this.episodes.pruneBelow(threshold);
    return { episodesPruned, factsDeduped: 0 };
  }
}
```

- [ ] **Step 4: Write memory index**

Write `packages/memory/src/index.ts`:

```typescript
export { HindsightMemory, type HindsightStores, type ReflectOptions, type ReflectStats } from "./hindsight.js";
export { InMemoryFactsStore, type IFactsStore } from "./networks/facts-store.js";
export { InMemoryEpisodesStore, type IEpisodesStore } from "./networks/episodes-store.js";
export { InMemorySummariesStore, type ISummariesStore } from "./networks/summaries-store.js";
export { InMemoryBeliefsStore, type IBeliefsStore } from "./networks/beliefs-store.js";
export * from "./db/schema.js";
export { createDb, type Database } from "./db/connection.js";
```

- [ ] **Step 5: Run all tests**

```bash
cd packages/memory && pnpm test
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/memory/src/hindsight.ts packages/memory/src/index.ts packages/memory/src/__tests__/hindsight.test.ts
git commit -m "feat(memory): add HindsightMemory manager with Retain/Recall/Reflect operations"
```

---

## Phase 4: Adaptive Intelligence

### Task 11: Caller Profiler with ACE

**Files:**
- Create: `packages/adaptive/package.json`
- Create: `packages/adaptive/tsconfig.json`
- Create: `packages/adaptive/vitest.config.ts`
- Create: `packages/adaptive/src/caller-profiler.ts`
- Create: `packages/adaptive/src/index.ts`
- Test: `packages/adaptive/src/__tests__/caller-profiler.test.ts`

- [ ] **Step 1: Scaffold adaptive package** (same pattern as connectors/memory)

- [ ] **Step 2: Write failing test for caller profiler ACE operations**

Write `packages/adaptive/src/__tests__/caller-profiler.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { CallerProfiler } from "../caller-profiler.js";
import { InMemoryBeliefsStore } from "@ygn-stem/memory";

describe("CallerProfiler", () => {
  let profiler: CallerProfiler;

  beforeEach(() => {
    profiler = new CallerProfiler(new InMemoryBeliefsStore());
  });

  it("generates a default profile for unknown caller", async () => {
    const profile = await profiler.getOrCreateProfile("new-caller");
    expect(profile.callerId).toBe("new-caller");
    expect(profile.philosophy.risk_tolerance).toBeDefined();
    expect(profile.philosophy.risk_tolerance!.value).toBe(0.5);
  });

  it("GENERATE: extracts signals from interaction", () => {
    const signals = CallerProfiler.generateSignals({
      messageLength: 500,
      technicalTerms: ["Z3", "SMT", "topology"],
      requestedDepth: "deep",
      timeOfDay: 14,
    });
    expect(signals.style_technical_depth).toBeGreaterThan(0.5);
  });

  it("CURATE: updates profile without context collapse", async () => {
    const profile = await profiler.getOrCreateProfile("alice");
    expect(profile.style.technical_depth?.value).toBe(0.5);

    await profiler.curate("alice", { style_technical_depth: 0.9 });
    const updated = await profiler.getOrCreateProfile("alice");
    expect(updated.style.technical_depth!.value).toBeGreaterThan(0.5);
    expect(updated.style.technical_depth!.interactionCount).toBe(1);
  });

  it("confidence gate increases with interactions", async () => {
    await profiler.getOrCreateProfile("alice");
    for (let i = 0; i < 10; i++) {
      await profiler.curate("alice", { style_technical_depth: 0.9 });
    }
    const profile = await profiler.getOrCreateProfile("alice");
    expect(profile.style.technical_depth!.confidence).toBeCloseTo(10 / 20, 1);
  });
});
```

- [ ] **Step 3: Implement CallerProfiler**

Write `packages/adaptive/src/caller-profiler.ts`:

```typescript
import type { CallerProfile, ProfileDimension } from "@ygn-stem/shared";
import type { IBeliefsStore } from "@ygn-stem/memory";

const KAPPA = 10;
const DEFAULT_DIMENSIONS: Record<string, string[]> = {
  philosophy: [
    "pragmatism_vs_idealism", "risk_tolerance", "innovation_orientation",
    "detail_focus_vs_big_picture", "speed_vs_thoroughness", "collaboration_vs_autonomy",
    "consistency_vs_experimentation", "simplicity_vs_completeness",
  ],
  principles: ["correctness_over_speed", "testing_emphasis", "security_mindedness", "code_quality_priority"],
  style: ["formality_level", "verbosity_preference", "technical_depth", "structure_preference", "communication_pattern"],
  habits: ["session_length_pattern", "iteration_tendency", "peak_activity_hours", "preferred_interaction_mode"],
};

function defaultDimension(): ProfileDimension {
  return { value: 0.5, confidence: 0, interactionCount: 0 };
}

function confidenceGate(n: number): number {
  return n / (n + KAPPA);
}

export class CallerProfiler {
  constructor(private readonly beliefs: IBeliefsStore) {}

  async getOrCreateProfile(callerId: string): Promise<CallerProfile> {
    const existing = await this.beliefs.getById(callerId);
    if (existing) return existing;

    const profile: CallerProfile = {
      callerId,
      philosophy: Object.fromEntries(DEFAULT_DIMENSIONS.philosophy.map((d) => [d, defaultDimension()])),
      principles: Object.fromEntries(DEFAULT_DIMENSIONS.principles.map((d) => [d, defaultDimension()])),
      style: Object.fromEntries(DEFAULT_DIMENSIONS.style.map((d) => [d, defaultDimension()])),
      habits: Object.fromEntries(DEFAULT_DIMENSIONS.habits.map((d) => [d, defaultDimension()])),
      preferredStrategies: {},
      organPreferences: {},
      skillSuccessRates: {},
      lastUpdated: new Date().toISOString(),
    };
    await this.beliefs.upsert(profile);
    return profile;
  }

  static generateSignals(context: {
    messageLength: number;
    technicalTerms: string[];
    requestedDepth: string;
    timeOfDay: number;
  }): Record<string, number> {
    const signals: Record<string, number> = {};
    signals.style_technical_depth = Math.min(1, context.technicalTerms.length / 5);
    signals.style_verbosity_preference = Math.min(1, context.messageLength / 1000);
    if (context.requestedDepth === "deep") signals.style_technical_depth = Math.max(signals.style_technical_depth!, 0.7);
    if (context.timeOfDay >= 22 || context.timeOfDay <= 5) signals.habits_peak_activity_hours = 0.2;
    else signals.habits_peak_activity_hours = 0.8;
    return signals;
  }

  async curate(callerId: string, signals: Record<string, number>): Promise<void> {
    const profile = await this.getOrCreateProfile(callerId);

    for (const [key, signal] of Object.entries(signals)) {
      const [category, ...rest] = key.split("_");
      const dimName = rest.join("_");
      const categoryMap = (profile as Record<string, Record<string, ProfileDimension>>)[category!];
      if (!categoryMap || !categoryMap[dimName]) continue;

      const dim = categoryMap[dimName]!;
      const n = dim.interactionCount + 1;
      const gate = confidenceGate(n);
      dim.value = (1 - gate) * signal + gate * dim.value;
      dim.confidence = confidenceGate(n);
      dim.interactionCount = n;
    }

    profile.lastUpdated = new Date().toISOString();
    await this.beliefs.upsert(profile);
  }
}
```

- [ ] **Step 4: Run tests and commit**

```bash
cd packages/adaptive && pnpm install && pnpm test
```

```bash
git add packages/adaptive/
git commit -m "feat(adaptive): add CallerProfiler with ACE context engineering"
```

---

### Task 12: Architecture Selector

**Files:**
- Create: `packages/adaptive/src/architecture-selector.ts`
- Test: `packages/adaptive/src/__tests__/architecture-selector.test.ts`

- [ ] **Step 1: Write failing test**

Write `packages/adaptive/src/__tests__/architecture-selector.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ArchitectureSelector } from "../architecture-selector.js";
import type { TaskProperty } from "@ygn-stem/shared";

describe("ArchitectureSelector", () => {
  const selector = new ArchitectureSelector();

  it("routes simple sequential tasks to single-agent", () => {
    const task: TaskProperty = {
      hasSequentialDeps: true,
      toolDensity: 1,
      isParallelizable: false,
      complexity: "simple",
      domainCount: 1,
      intent: "simple query",
    };
    const routing = selector.select(task);
    expect(routing.architecture).toBe("single-agent");
    expect(routing.primaryOrgan).toBe("ygn");
  });

  it("routes parallelizable multi-domain to centralized multi-agent", () => {
    const task: TaskProperty = {
      hasSequentialDeps: false,
      toolDensity: 4,
      isParallelizable: true,
      complexity: "complex",
      domainCount: 3,
      intent: "multi-domain analysis",
    };
    const routing = selector.select(task);
    expect(routing.architecture).toBe("centralized-multi-agent");
    expect(routing.primaryOrgan).toBe("sage");
  });

  it("routes high-criticality to adversarial with oversight", () => {
    const task: TaskProperty = {
      hasSequentialDeps: false,
      toolDensity: 2,
      isParallelizable: false,
      complexity: "complex",
      domainCount: 1,
      intent: "security audit critical system",
    };
    const routing = selector.select(task, { highCriticality: true });
    expect(routing.architecture).toBe("adversarial-redblue");
    expect(routing.oversightRequired).toBe(true);
  });

  it("routes formal verification requests to SMT pipeline", () => {
    const task: TaskProperty = {
      hasSequentialDeps: true,
      toolDensity: 2,
      isParallelizable: false,
      complexity: "complex",
      domainCount: 1,
      intent: "prove memory safety of this function",
    };
    const routing = selector.select(task, { requiresFormalVerification: true });
    expect(routing.architecture).toBe("smt-pipeline");
    expect(routing.evidenceCapture).toBe(true);
  });

  it("defaults simple Q&A to direct-llm", () => {
    const task: TaskProperty = {
      hasSequentialDeps: false,
      toolDensity: 0,
      isParallelizable: false,
      complexity: "simple",
      domainCount: 1,
      intent: "what is MCP?",
    };
    const routing = selector.select(task);
    expect(routing.architecture).toBe("direct-llm");
  });
});
```

- [ ] **Step 2: Implement ArchitectureSelector**

Write `packages/adaptive/src/architecture-selector.ts`:

```typescript
import type { TaskProperty, OrganRouting, ArchitectureChoice } from "@ygn-stem/shared";

export interface SelectionHints {
  highCriticality?: boolean;
  requiresFormalVerification?: boolean;
  requiresKnowledge?: boolean;
}

export class ArchitectureSelector {
  select(task: TaskProperty, hints: SelectionHints = {}): OrganRouting {
    if (hints.requiresFormalVerification) {
      return {
        architecture: "smt-pipeline",
        primaryOrgan: "sage",
        secondaryOrgans: ["vm"],
        oversightRequired: true,
        evidenceCapture: true,
      };
    }

    if (hints.highCriticality) {
      return {
        architecture: "adversarial-redblue",
        primaryOrgan: "ygn",
        secondaryOrgans: ["metacog"],
        oversightRequired: true,
        evidenceCapture: true,
      };
    }

    if (hints.requiresKnowledge) {
      return {
        architecture: "knowledge-pipeline",
        primaryOrgan: "sage",
        secondaryOrgans: ["finance"],
        oversightRequired: false,
        evidenceCapture: false,
      };
    }

    if (task.isParallelizable && task.domainCount > 1) {
      return {
        architecture: "centralized-multi-agent",
        primaryOrgan: "sage",
        secondaryOrgans: ["ygn"],
        oversightRequired: task.complexity === "complex",
        evidenceCapture: false,
      };
    }

    if (task.complexity === "simple" && task.toolDensity === 0) {
      return {
        architecture: "direct-llm",
        primaryOrgan: "ygn",
        secondaryOrgans: [],
        oversightRequired: false,
        evidenceCapture: false,
      };
    }

    return {
      architecture: "single-agent",
      primaryOrgan: "ygn",
      secondaryOrgans: [],
      oversightRequired: false,
      evidenceCapture: false,
    };
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd packages/adaptive && pnpm test
```

```bash
git add packages/adaptive/src/architecture-selector.ts packages/adaptive/src/__tests__/architecture-selector.test.ts
git commit -m "feat(adaptive): add ArchitectureSelector based on Google Scaling Science"
```

---

### Task 13: Skills Engine with maturity lifecycle

**Files:**
- Create: `packages/adaptive/src/skills-engine.ts`
- Test: `packages/adaptive/src/__tests__/skills-engine.test.ts`

- [ ] **Step 1: Write failing test**

Write `packages/adaptive/src/__tests__/skills-engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SkillsEngine } from "../skills-engine.js";
import type { Skill, SkillOutcome } from "@ygn-stem/shared";

const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  name: "test-skill",
  description: "A test skill",
  triggers: ["test", "example"],
  maturity: "progenitor",
  activations: 0,
  successRate: 0,
  organs: ["sage"],
  instructions: "1. Do something",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("SkillsEngine", () => {
  let engine: SkillsEngine;

  beforeEach(() => {
    engine = new SkillsEngine();
  });

  it("registers a plugin skill", async () => {
    await engine.register(makeSkill({ name: "my-skill" }));
    const found = await engine.getByName("my-skill");
    expect(found).toBeDefined();
  });

  it("matches skill by trigger keywords", async () => {
    await engine.register(makeSkill({ name: "rust-review", triggers: ["rust", "review", "unsafe"] }));
    await engine.register(makeSkill({ name: "deploy", triggers: ["deploy", "production"] }));
    const matches = await engine.match("review this unsafe rust code");
    expect(matches).toHaveLength(1);
    expect(matches[0]!.skill.name).toBe("rust-review");
  });

  it("committed skills can short-circuit", async () => {
    await engine.register(makeSkill({ name: "s1", maturity: "committed", activations: 5, successRate: 0.8 }));
    const matches = await engine.match("test example");
    expect(matches[0]!.canShortCircuit).toBe(true);
  });

  it("progenitor skills cannot short-circuit", async () => {
    await engine.register(makeSkill({ name: "s1", maturity: "progenitor" }));
    const matches = await engine.match("test example");
    expect(matches[0]!.canShortCircuit).toBe(false);
  });

  it("promotes progenitor to committed after 3 successes with ≥60% rate", async () => {
    await engine.register(makeSkill({ name: "s1", maturity: "progenitor", activations: 2, successRate: 1.0 }));
    await engine.recordOutcome({ skillName: "s1", success: true, durationMs: 100, callerId: "alice" });
    const skill = await engine.getByName("s1");
    expect(skill!.maturity).toBe("committed");
  });

  it("promotes committed to mature after 10 successes", async () => {
    await engine.register(makeSkill({ name: "s1", maturity: "committed", activations: 9, successRate: 0.9 }));
    await engine.recordOutcome({ skillName: "s1", success: true, durationMs: 100, callerId: "alice" });
    const skill = await engine.getByName("s1");
    expect(skill!.maturity).toBe("mature");
  });

  it("triggers apoptosis at ≥10 activations with <30% success", async () => {
    await engine.register(makeSkill({ name: "s1", maturity: "committed", activations: 9, successRate: 0.2 }));
    await engine.recordOutcome({ skillName: "s1", success: false, durationMs: 100, callerId: "alice" });
    const skill = await engine.getByName("s1");
    expect(skill).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement SkillsEngine**

Write `packages/adaptive/src/skills-engine.ts`:

```typescript
import type { Skill, SkillMatchResult, SkillOutcome } from "@ygn-stem/shared";

const COMMITTED_THRESHOLD = 3;
const COMMITTED_SUCCESS_RATE = 0.6;
const MATURE_THRESHOLD = 10;
const MATURE_SUCCESS_RATE = 0.6;
const APOPTOSIS_THRESHOLD = 10;
const APOPTOSIS_RATE = 0.3;

export class SkillsEngine {
  private readonly skills = new Map<string, Skill>();

  async register(skill: Skill): Promise<void> {
    this.skills.set(skill.name, skill);
  }

  async getByName(name: string): Promise<Skill | undefined> {
    return this.skills.get(name);
  }

  async match(input: string): Promise<SkillMatchResult[]> {
    const words = input.toLowerCase().split(/\s+/);
    const results: SkillMatchResult[] = [];

    for (const skill of this.skills.values()) {
      let score = 0;
      for (const trigger of skill.triggers) {
        if (words.includes(trigger.toLowerCase())) score++;
      }
      if (score > 0) {
        const maturityBonus = skill.maturity === "mature" ? 2 : skill.maturity === "committed" ? 1 : 0;
        results.push({
          skill,
          score: score + maturityBonus,
          canShortCircuit: skill.maturity === "committed" || skill.maturity === "mature",
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async recordOutcome(outcome: SkillOutcome): Promise<void> {
    const skill = this.skills.get(outcome.skillName);
    if (!skill) return;

    const newActivations = skill.activations + 1;
    const newSuccessRate =
      (skill.successRate * skill.activations + (outcome.success ? 1 : 0)) / newActivations;

    skill.activations = newActivations;
    skill.successRate = newSuccessRate;
    skill.updatedAt = new Date().toISOString();

    // Apoptosis check
    if (newActivations >= APOPTOSIS_THRESHOLD && newSuccessRate < APOPTOSIS_RATE) {
      this.skills.delete(outcome.skillName);
      return;
    }

    // Maturation check
    if (skill.maturity === "progenitor" && newActivations >= COMMITTED_THRESHOLD && newSuccessRate >= COMMITTED_SUCCESS_RATE) {
      skill.maturity = "committed";
    } else if (skill.maturity === "committed" && newActivations >= MATURE_THRESHOLD && newSuccessRate >= MATURE_SUCCESS_RATE) {
      skill.maturity = "mature";
    }
  }

  async listAll(): Promise<Skill[]> {
    return Array.from(this.skills.values());
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd packages/adaptive && pnpm test
```

```bash
git add packages/adaptive/src/skills-engine.ts packages/adaptive/src/__tests__/skills-engine.test.ts
git commit -m "feat(adaptive): add SkillsEngine with maturity lifecycle and apoptosis"
```

---

### Task 14: Sleep-Time Compute worker

**Files:**
- Create: `packages/adaptive/src/sleep-worker.ts`
- Test: `packages/adaptive/src/__tests__/sleep-worker.test.ts`

- [ ] **Step 1: Write failing test**

Write `packages/adaptive/src/__tests__/sleep-worker.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SleepWorker } from "../sleep-worker.js";
import { HindsightMemory, InMemoryFactsStore, InMemoryEpisodesStore, InMemorySummariesStore, InMemoryBeliefsStore } from "@ygn-stem/memory";

describe("SleepWorker", () => {
  let memory: HindsightMemory;
  let worker: SleepWorker;

  beforeEach(() => {
    memory = new HindsightMemory({
      facts: new InMemoryFactsStore(),
      episodes: new InMemoryEpisodesStore(),
      summaries: new InMemorySummariesStore(),
      beliefs: new InMemoryBeliefsStore(),
    });
    worker = new SleepWorker(memory);
  });

  it("runs consolidation and returns stats", async () => {
    await memory.retain({
      episode: {
        id: "low",
        timestamp: new Date().toISOString(),
        callerId: "alice",
        intent: "trivial",
        entities: [],
        toolsUsed: [],
        outcome: "success",
        durationMs: 10,
        importanceScore: 0.05,
      },
    });
    await memory.retain({
      episode: {
        id: "high",
        timestamp: new Date().toISOString(),
        callerId: "alice",
        intent: "important",
        entities: [],
        toolsUsed: [],
        outcome: "success",
        durationMs: 5000,
        importanceScore: 0.95,
      },
    });

    const stats = await worker.run();
    expect(stats.episodesPruned).toBe(1);
    expect(stats.phase).toBe("sleep");
  });

  it("is idempotent — running twice does not double-prune", async () => {
    await memory.retain({
      episode: {
        id: "low",
        timestamp: new Date().toISOString(),
        callerId: "alice",
        intent: "trivial",
        entities: [],
        toolsUsed: [],
        outcome: "success",
        durationMs: 10,
        importanceScore: 0.05,
      },
    });
    await worker.run();
    const stats2 = await worker.run();
    expect(stats2.episodesPruned).toBe(0);
  });
});
```

- [ ] **Step 2: Implement SleepWorker**

Write `packages/adaptive/src/sleep-worker.ts`:

```typescript
import type { HindsightMemory } from "@ygn-stem/memory";

export interface SleepStats {
  phase: "sleep";
  episodesPruned: number;
  factsDeduped: number;
  durationMs: number;
}

export class SleepWorker {
  constructor(
    private readonly memory: HindsightMemory,
    private readonly importanceThreshold = 0.3,
  ) {}

  async run(): Promise<SleepStats> {
    const start = Date.now();
    const reflectStats = await this.memory.reflect({
      importanceThreshold: this.importanceThreshold,
    });
    return {
      phase: "sleep",
      episodesPruned: reflectStats.episodesPruned,
      factsDeduped: reflectStats.factsDeduped,
      durationMs: Date.now() - start,
    };
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd packages/adaptive && pnpm test
```

```bash
git add packages/adaptive/src/sleep-worker.ts packages/adaptive/src/__tests__/sleep-worker.test.ts
git commit -m "feat(adaptive): add SleepWorker for idle-time memory consolidation"
```

---

### Task 15: Adaptive package exports

**Files:**
- Modify: `packages/adaptive/src/index.ts`

- [ ] **Step 1: Write index**

Write `packages/adaptive/src/index.ts`:

```typescript
export { CallerProfiler } from "./caller-profiler.js";
export { ArchitectureSelector, type SelectionHints } from "./architecture-selector.js";
export { SkillsEngine } from "./skills-engine.js";
export { SleepWorker, type SleepStats } from "./sleep-worker.js";
```

- [ ] **Step 2: Commit**

```bash
git add packages/adaptive/src/index.ts
git commit -m "feat(adaptive): export CallerProfiler, ArchitectureSelector, SkillsEngine"
```

---

## Phase 5: Protocol Gateway

### Task 16: Express.js gateway with health + MCP router

**Files:**
- Create: `packages/gateway/package.json`
- Create: `packages/gateway/tsconfig.json`
- Create: `packages/gateway/vitest.config.ts`
- Create: `packages/gateway/src/middleware/request-id.ts`
- Create: `packages/gateway/src/middleware/error-handler.ts`
- Create: `packages/gateway/src/routes/health.ts`
- Create: `packages/gateway/src/routes/mcp.ts`
- Create: `packages/gateway/src/routes/a2a.ts`
- Create: `packages/gateway/src/gateway.ts`
- Create: `packages/gateway/src/index.ts`
- Test: `packages/gateway/src/__tests__/gateway.test.ts`

- [ ] **Step 1: Scaffold gateway package with Express.js 5 deps**

Write `packages/gateway/package.json`:

```json
{
  "name": "@ygn-stem/gateway",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "dev": "tsx watch src/server.ts"
  },
  "dependencies": {
    "@ygn-stem/shared": "workspace:*",
    "@ygn-stem/connectors": "workspace:*",
    "@ygn-stem/memory": "workspace:*",
    "@ygn-stem/adaptive": "workspace:*",
    "express": "^5.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0",
    "tsx": "^4.0.0"
  }
}
```

- [ ] **Step 2: Write failing test for gateway health + MCP routing**

Write `packages/gateway/src/__tests__/gateway.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createGateway } from "../gateway.js";
import { OrganRegistry } from "@ygn-stem/connectors";

describe("Gateway", () => {
  const registry = new OrganRegistry();
  const app = createGateway({ registry });

  it("GET /health returns 200 with status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /organs returns empty array when no organs", async () => {
    const res = await request(app).get("/organs");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /.well-known/agent.json returns agent card", async () => {
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("YGN-STEM");
  });

  it("POST /mcp with tools/list returns aggregated tools", async () => {
    const res = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", method: "tools/list", id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe("2.0");
    expect(res.body.result.tools).toBeDefined();
  });

  it("adds X-Request-Id header to responses", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
```

- [ ] **Step 3: Implement request-id middleware**

Write `packages/gateway/src/middleware/request-id.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers["x-request-id"] as string) ?? randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-Id", id);
  next();
}
```

- [ ] **Step 4: Implement error handler middleware**

Write `packages/gateway/src/middleware/error-handler.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({
    error: err.message,
    code: (err as { code?: string }).code ?? "INTERNAL_ERROR",
  });
}
```

- [ ] **Step 5: Implement health route**

Write `packages/gateway/src/routes/health.ts`:

```typescript
import { Router } from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";

export function healthRouter(registry: OrganRegistry): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      organs: registry.list().map((o) => ({ name: o.name, status: o.status })),
    });
  });

  router.get("/organs", (_req, res) => {
    res.json(registry.list());
  });

  return router;
}
```

- [ ] **Step 6: Implement A2A agent card route**

Write `packages/gateway/src/routes/a2a.ts`:

```typescript
import { Router } from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";

export function a2aRouter(registry: OrganRegistry): Router {
  const router = Router();

  router.get("/.well-known/agent.json", (_req, res) => {
    res.json({
      name: "YGN-STEM",
      description: "Adaptive Agent Fabric — interoperability and intelligence layer for the YGN ecosystem",
      capabilities: { streaming: true, pushNotifications: false },
      skills: registry.allTools().map((t) => ({
        id: t.name,
        name: t.name,
        description: t.description,
      })),
      interfaces: [
        { protocol: "mcp", url: "/mcp" },
        { protocol: "a2a", url: "/a2a" },
        { protocol: "ag-ui", url: "/ag-ui/stream" },
      ],
    });
  });

  return router;
}
```

- [ ] **Step 7: Implement MCP gateway route**

Write `packages/gateway/src/routes/mcp.ts`:

```typescript
import { Router } from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";
import { JsonRpcRequestSchema } from "@ygn-stem/shared";

export function mcpRouter(registry: OrganRegistry): Router {
  const router = Router();

  router.post("/mcp", async (req, res) => {
    const parseResult = JsonRpcRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid JSON-RPC request" },
        id: null,
      });
      return;
    }

    const rpc = parseResult.data;

    if (rpc.method === "tools/list") {
      res.json({
        jsonrpc: "2.0",
        result: { tools: registry.allTools() },
        id: rpc.id ?? null,
      });
      return;
    }

    if (rpc.method === "tools/call") {
      const params = rpc.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      if (!params?.name) {
        res.json({
          jsonrpc: "2.0",
          error: { code: -32602, message: "Missing tool name" },
          id: rpc.id ?? null,
        });
        return;
      }
      try {
        const result = await registry.callTool(params.name, params.arguments ?? {});
        res.json({ jsonrpc: "2.0", result, id: rpc.id ?? null });
      } catch (err) {
        res.json({
          jsonrpc: "2.0",
          error: { code: -32603, message: (err as Error).message },
          id: rpc.id ?? null,
        });
      }
      return;
    }

    res.json({
      jsonrpc: "2.0",
      error: { code: -32601, message: `Method not found: ${rpc.method}` },
      id: rpc.id ?? null,
    });
  });

  return router;
}
```

- [ ] **Step 8: Implement gateway factory**

Write `packages/gateway/src/gateway.ts`:

```typescript
import express from "express";
import type { OrganRegistry } from "@ygn-stem/connectors";
import { requestId } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { a2aRouter } from "./routes/a2a.js";
import { mcpRouter } from "./routes/mcp.js";

export interface GatewayOptions {
  registry: OrganRegistry;
}

export function createGateway(options: GatewayOptions): express.Express {
  const app = express();

  app.use(express.json());
  app.use(requestId);

  app.use(healthRouter(options.registry));
  app.use(a2aRouter(options.registry));
  app.use(mcpRouter(options.registry));

  app.use(errorHandler);

  return app;
}
```

Write `packages/gateway/src/index.ts`:

```typescript
export { createGateway, type GatewayOptions } from "./gateway.js";
```

- [ ] **Step 9: Run tests**

```bash
cd packages/gateway && pnpm install && pnpm test
```

Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add packages/gateway/
git commit -m "feat(gateway): add Express.js 5 gateway with health, A2A agent card, MCP tool aggregation"
```

---

## Phase 6: Commerce (UCP + AP2)

### Task 17: UCP checkout sessions

**Files:**
- Create: `packages/commerce/package.json`, tsconfig, vitest config
- Create: `packages/commerce/src/ucp.ts`
- Create: `packages/commerce/src/index.ts`
- Test: `packages/commerce/src/__tests__/ucp.test.ts`

- [ ] **Step 1: Scaffold commerce package, write failing test for UCP idempotency**

- [ ] **Step 2: Implement UCP checkout session handler with idempotency cache**

- [ ] **Step 3: Run tests, commit**

### Task 18: AP2 payment mandates

**Files:**
- Create: `packages/commerce/src/ap2.ts`
- Test: `packages/commerce/src/__tests__/ap2.test.ts`

- [ ] **Step 1: Write failing test for 3-phase payment lifecycle**

- [ ] **Step 2: Implement AP2 with Intent → Mandate → Receipt flow**

- [ ] **Step 3: Run tests, commit**

---

## Phase 7: Docker + Integration

### Task 19: Docker Compose setup

**Files:**
- Create: `docker/Dockerfile`
- Create: `docker/docker-compose.yml`
- Create: `docker/.env.docker`

- [ ] **Step 1: Write Dockerfile (multi-stage, pnpm)**

- [ ] **Step 2: Write docker-compose.yml (stem + postgres/pgvector + redis)**

- [ ] **Step 3: Test with `docker compose up --build`**

- [ ] **Step 4: Commit**

### Task 20: E2E integration test

**Files:**
- Create: `packages/gateway/src/__tests__/e2e.test.ts`

- [ ] **Step 1: Write E2E test: full request flow through all layers with mock organs**

Tests: incoming MCP request → Architecture Selector → mock organ call → Hindsight Retain → response.

- [ ] **Step 2: Run, verify, commit**

### Task 21: Initial commit to remote

- [ ] **Step 1: Push to GitHub**

```bash
git push -u origin main
```
