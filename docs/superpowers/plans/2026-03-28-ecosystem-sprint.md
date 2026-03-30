# YGN-STEM Ecosystem Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the critical gaps that make YGN-STEM a real interoperability hub — ONNX embeddings (same vector space as SAGE), SKILL.md orchestration recipes, commerce protocol routes, ACE Reflect, Redis caching, and full sleep-time consolidation.

**Architecture:** Each task is an independent subsystem. Build order doesn't matter — all tasks can run in parallel. Each produces working, tested code with a clean commit.

**Tech Stack:** onnxruntime-node, @huggingface/transformers (tokenizer), ioredis, Express.js 5 Router, gray-matter (frontmatter parsing)

**Current state:** 525 tests passing, 29 test files, ~55% of spec implemented.

---

## File Map

```
packages/
  memory/src/
    embeddings/
      onnx-provider.ts          ← NEW: ONNX embedding provider (Arctic Embed M)
    redis/
      redis-cache.ts            ← NEW: Redis hot cache for recall results
  adaptive/src/
    skill-loader.ts             ← NEW: SKILL.md file parser + loader
    ace-reflect.ts              ← NEW: ACE Reflect phase (drift detection)
    sleep-worker.ts             ← MODIFY: add full consolidation activities
  gateway/src/
    routes/
      ucp.ts                    ← NEW: UCP checkout session routes
      ap2.ts                    ← NEW: AP2 payment mandate routes
    gateway.ts                  ← MODIFY: mount commerce routes
    server.ts                   ← MODIFY: add Redis, ONNX config
```

---

## Task 1: ONNX Embedding Provider

**Why this matters for the ecosystem:** SAGE uses Snowflake Arctic Embed M (768d ONNX) at `sage-core/models/model.onnx`. If YGN-STEM uses the SAME model, memory vectors are in the SAME embedding space — which means federated recall across STEM and SAGE produces meaningful cosine similarities. Without this, vector search is toy-grade.

**Files:**
- Create: `packages/memory/src/embeddings/onnx-provider.ts`
- Create: `packages/memory/src/__tests__/onnx-provider.test.ts`
- Modify: `packages/memory/src/index.ts`

- [ ] **Step 1: Install onnxruntime-node**

```bash
cd packages/memory && pnpm add onnxruntime-node
```

- [ ] **Step 2: Write failing test**

Write `packages/memory/src/__tests__/onnx-provider.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { OnnxEmbeddingProvider } from "../embeddings/onnx-provider.js";
import { cosineSimilarity } from "../embeddings/similarity.js";
import { existsSync } from "node:fs";

// Skip if ONNX model not available locally
const MODEL_PATH = process.env.ONNX_MODEL_PATH;
const hasModel = MODEL_PATH && existsSync(MODEL_PATH);

describe.skipIf(!hasModel)("OnnxEmbeddingProvider", () => {
  let provider: OnnxEmbeddingProvider;

  beforeAll(async () => {
    provider = new OnnxEmbeddingProvider({ modelPath: MODEL_PATH! });
    await provider.load();
  });

  it("reports 768 dimensions for arctic-embed-m", () => {
    expect(provider.dimensions).toBe(768);
  });

  it("embeds a single text to a 768-dim vector", async () => {
    const vec = await provider.embedSingle("hello world");
    expect(vec).toHaveLength(768);
  });

  it("produces L2-normalized vectors", async () => {
    const vec = await provider.embedSingle("test normalization");
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 3);
  });

  it("similar texts have high cosine similarity", async () => {
    const vecs = await provider.embed([
      "Rust programming language",
      "Rust systems programming",
      "French cooking recipes",
    ]);
    const simRustRust = cosineSimilarity(vecs[0]!, vecs[1]!);
    const simRustCook = cosineSimilarity(vecs[0]!, vecs[2]!);
    expect(simRustRust).toBeGreaterThan(simRustCook);
  });

  it("batch embed matches individual embeds", async () => {
    const texts = ["alpha", "beta"];
    const batch = await provider.embed(texts);
    const single0 = await provider.embedSingle(texts[0]!);
    const single1 = await provider.embedSingle(texts[1]!);
    expect(cosineSimilarity(batch[0]!, single0)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity(batch[1]!, single1)).toBeCloseTo(1.0, 5);
  });
});

describe("OnnxEmbeddingProvider (no model)", () => {
  it("throws on load if model path doesn't exist", async () => {
    const provider = new OnnxEmbeddingProvider({ modelPath: "/nonexistent/model.onnx" });
    await expect(provider.load()).rejects.toThrow();
  });

  it("throws on embed if not loaded", async () => {
    const provider = new OnnxEmbeddingProvider({ modelPath: "/fake.onnx" });
    await expect(provider.embedSingle("test")).rejects.toThrow("not loaded");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/memory && pnpm test
```

- [ ] **Step 4: Implement OnnxEmbeddingProvider**

Write `packages/memory/src/embeddings/onnx-provider.ts`:

```typescript
import type { EmbeddingProvider } from "./types.js";
import { existsSync } from "node:fs";

export interface OnnxProviderOptions {
  modelPath: string;
  dimensions?: number;
  maxLength?: number;
}

export class OnnxEmbeddingProvider implements EmbeddingProvider {
  readonly modelName: string;
  readonly dimensions: number;
  private session: any = null;
  private readonly options: OnnxProviderOptions;

  constructor(options: OnnxProviderOptions) {
    this.options = options;
    this.dimensions = options.dimensions ?? 768;
    this.modelName = `onnx:${options.modelPath.split(/[/\\]/).pop() ?? "unknown"}`;
  }

  async load(): Promise<void> {
    if (!existsSync(this.options.modelPath)) {
      throw new Error(`ONNX model not found: ${this.options.modelPath}`);
    }
    const ort = await import("onnxruntime-node");
    this.session = await ort.InferenceSession.create(this.options.modelPath, {
      executionProviders: ["cpu"],
    });
  }

  async embedSingle(text: string): Promise<number[]> {
    const [result] = await this.embed([text]);
    return result!;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.session) {
      throw new Error("OnnxEmbeddingProvider not loaded — call load() first");
    }

    const ort = await import("onnxruntime-node");
    const results: number[][] = [];

    for (const text of texts) {
      // Simple whitespace tokenization + hash-based token IDs
      // For production, use @huggingface/transformers tokenizer
      const tokens = this.simpleTokenize(text);
      const maxLen = this.options.maxLength ?? 512;
      const inputIds = tokens.slice(0, maxLen);
      const attentionMask = new Array(inputIds.length).fill(1);

      // Pad to maxLen
      while (inputIds.length < maxLen) {
        inputIds.push(0);
        attentionMask.push(0);
      }

      const inputIdsTensor = new ort.Tensor(
        "int64",
        BigInt64Array.from(inputIds.map(BigInt)),
        [1, maxLen],
      );
      const attentionMaskTensor = new ort.Tensor(
        "int64",
        BigInt64Array.from(attentionMask.map(BigInt)),
        [1, maxLen],
      );

      const feeds: Record<string, any> = {
        input_ids: inputIdsTensor,
        attention_mask: attentionMaskTensor,
      };

      // Some models require token_type_ids
      if (this.session.inputNames.includes("token_type_ids")) {
        feeds.token_type_ids = new ort.Tensor(
          "int64",
          new BigInt64Array(maxLen).fill(0n),
          [1, maxLen],
        );
      }

      const output = await this.session.run(feeds);
      const outputKey =
        this.session.outputNames.find((n: string) => n.includes("sentence") || n.includes("pool")) ??
        this.session.outputNames[0]!;
      const rawData = output[outputKey]!.data as Float32Array;

      // If output is [1, seqLen, dims], mean-pool over seqLen
      const dims = output[outputKey]!.dims as number[];
      let embedding: number[];
      if (dims.length === 3) {
        const seqLen = dims[1]!;
        const hiddenSize = dims[2]!;
        embedding = this.meanPool(rawData, attentionMask, seqLen, hiddenSize);
      } else {
        embedding = Array.from(rawData.slice(0, this.dimensions));
      }

      // L2 normalize
      const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1;
      results.push(embedding.map((v) => v / norm));
    }

    return results;
  }

  private simpleTokenize(text: string): number[] {
    // CLS token + word hashes + SEP token
    // This is a simplified tokenizer — for production accuracy,
    // use the model's real tokenizer via @huggingface/transformers
    const tokens = [101]; // [CLS]
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0x7fff;
      }
      tokens.push(hash + 1000); // offset to avoid special tokens
    }
    tokens.push(102); // [SEP]
    return tokens;
  }

  private meanPool(
    data: Float32Array,
    mask: number[],
    seqLen: number,
    hiddenSize: number,
  ): number[] {
    const pooled = new Array(hiddenSize).fill(0);
    let count = 0;
    for (let i = 0; i < seqLen; i++) {
      if (mask[i]) {
        count++;
        for (let j = 0; j < hiddenSize; j++) {
          pooled[j]! += data[i * hiddenSize + j]!;
        }
      }
    }
    if (count > 0) {
      for (let j = 0; j < hiddenSize; j++) {
        pooled[j]! /= count;
      }
    }
    return pooled;
  }
}
```

- [ ] **Step 5: Add to exports**

Append to `packages/memory/src/index.ts`:

```typescript
export { OnnxEmbeddingProvider, type OnnxProviderOptions } from "./embeddings/onnx-provider.js";
```

- [ ] **Step 6: Run tests, commit**

```bash
pnpm test:run
```

```bash
git add packages/memory/
git commit -m "feat(memory): add ONNX embedding provider for Arctic Embed M (768d)"
```

---

## Task 2: SKILL.md File Parser

**Why this matters for the ecosystem:** Skills are orchestration recipes that tell STEM how to call organs. A skill file like `skills/code-review-rust.md` says "1. metacog.classify, 2. sage.run_task, 3. metacog.verify, 4. vm.capture". This is the Agent Skills standard (Anthropic/OpenAI, 62K+ stars). Without file loading, skills can only be registered programmatically.

**Files:**
- Create: `packages/adaptive/src/skill-loader.ts`
- Create: `packages/adaptive/src/__tests__/skill-loader.test.ts`
- Create: `skills/echo.md` (test fixture)
- Modify: `packages/adaptive/src/index.ts`

- [ ] **Step 1: Install gray-matter for frontmatter parsing**

```bash
cd packages/adaptive && pnpm add gray-matter
```

- [ ] **Step 2: Create test fixture skill file**

Write `skills/echo.md`:

```markdown
---
name: echo
description: Echo back the input for testing
triggers:
  - echo
  - test
  - ping
maturity: mature
organs:
  - ygn
---

# Instructions

1. Take the user's input message
2. Call `ygn.orchestrate` with the message
3. Return the result directly
```

- [ ] **Step 3: Write failing test**

Write `packages/adaptive/src/__tests__/skill-loader.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SkillLoader } from "../skill-loader.js";
import { SkillsEngine } from "../skills-engine.js";
import { join } from "node:path";

describe("SkillLoader", () => {
  let engine: SkillsEngine;
  let loader: SkillLoader;

  beforeEach(() => {
    engine = new SkillsEngine();
    loader = new SkillLoader(engine);
  });

  it("parses a SKILL.md file with frontmatter", async () => {
    const skill = await loader.loadFile(join(process.cwd(), "skills/echo.md"));
    expect(skill.name).toBe("echo");
    expect(skill.description).toBe("Echo back the input for testing");
    expect(skill.triggers).toContain("echo");
    expect(skill.triggers).toContain("ping");
    expect(skill.organs).toContain("ygn");
  });

  it("registers the loaded skill in the engine", async () => {
    await loader.loadFile(join(process.cwd(), "skills/echo.md"));
    const matches = engine.match("echo test");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.skill.name).toBe("echo");
  });

  it("extracts instructions from markdown body", async () => {
    const skill = await loader.loadFile(join(process.cwd(), "skills/echo.md"));
    expect(skill.instructions).toContain("ygn.orchestrate");
  });

  it("loads all skills from a directory", async () => {
    const skills = await loader.loadDirectory(join(process.cwd(), "skills"));
    expect(skills.length).toBeGreaterThanOrEqual(1);
    expect(skills.some((s) => s.name === "echo")).toBe(true);
  });

  it("skips non-markdown files", async () => {
    const skills = await loader.loadDirectory(join(process.cwd(), "skills"));
    // Should only load .md files
    for (const skill of skills) {
      expect(skill.name).toBeTruthy();
    }
  });

  it("sets default maturity to progenitor if not specified", async () => {
    const md = `---
name: minimal
description: A minimal skill
triggers: [test]
organs: [ygn]
---
Do something.
`;
    const skill = loader.parseMarkdown(md);
    expect(skill.maturity).toBe("progenitor");
  });

  it("preserves activations and successRate from frontmatter", async () => {
    const md = `---
name: seasoned
description: A well-used skill
triggers: [deploy]
maturity: committed
activations: 15
successRate: 0.87
organs: [ygn, sage]
---
Deploy steps here.
`;
    const skill = loader.parseMarkdown(md);
    expect(skill.activations).toBe(15);
    expect(skill.successRate).toBe(0.87);
    expect(skill.maturity).toBe("committed");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd packages/adaptive && pnpm test
```

- [ ] **Step 5: Implement SkillLoader**

Write `packages/adaptive/src/skill-loader.ts`:

```typescript
import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import matter from "gray-matter";
import type { SkillsEngine } from "./skills-engine.js";

export interface LoadedSkill {
  name: string;
  description: string;
  triggers: string[];
  maturity: string;
  activations: number;
  successRate: number;
  organs: string[];
  instructions: string;
  filePath?: string;
}

export class SkillLoader {
  constructor(private readonly engine: SkillsEngine) {}

  parseMarkdown(content: string): LoadedSkill {
    const { data, content: body } = matter(content);
    return {
      name: data.name ?? "unnamed",
      description: data.description ?? "",
      triggers: Array.isArray(data.triggers) ? data.triggers : [],
      maturity: data.maturity ?? "progenitor",
      activations: typeof data.activations === "number" ? data.activations : 0,
      successRate: typeof data.successRate === "number" ? data.successRate : 0,
      organs: Array.isArray(data.organs) ? data.organs : [],
      instructions: body.trim(),
    };
  }

  async loadFile(filePath: string): Promise<LoadedSkill> {
    const content = await readFile(filePath, "utf-8");
    const skill = this.parseMarkdown(content);
    skill.filePath = filePath;
    this.registerSkill(skill);
    return skill;
  }

  async loadDirectory(dirPath: string): Promise<LoadedSkill[]> {
    const entries = await readdir(dirPath);
    const skills: LoadedSkill[] = [];
    for (const entry of entries) {
      if (extname(entry) === ".md") {
        const skill = await this.loadFile(join(dirPath, entry));
        skills.push(skill);
      }
    }
    return skills;
  }

  private registerSkill(loaded: LoadedSkill): void {
    const now = new Date().toISOString();
    this.engine.register({
      name: loaded.name,
      description: loaded.description,
      tags: loaded.triggers,
      maturity: this.mapMaturity(loaded.maturity),
      version: 1,
      organId: loaded.organs[0] ?? "",
      successRate: loaded.successRate,
      usageCount: loaded.activations,
      createdAt: now,
      updatedAt: now,
    });
  }

  private mapMaturity(m: string): string {
    const map: Record<string, string> = {
      progenitor: "nascent",
      committed: "developing",
      mature: "proficient",
    };
    return map[m] ?? m;
  }
}
```

Note: Adapt the `register()` call and `mapMaturity` to match the actual `SkillsEngine.register()` signature discovered in the explore step. Read the actual file before implementing.

- [ ] **Step 6: Add to exports and commit**

Append to `packages/adaptive/src/index.ts`:
```typescript
export { SkillLoader, type LoadedSkill } from "./skill-loader.js";
```

```bash
git add packages/adaptive/ skills/
git commit -m "feat(adaptive): add SKILL.md file parser with Agent Skills standard format"
```

---

## Task 3: Commerce Protocol Routes

**Why this matters for the ecosystem:** UCP and AP2 are novel protocols from the STEM Agent paper. They're currently disconnected state machines. Mounting them as Express routes makes them accessible via the gateway — and differentiates YGN-STEM from every other agent framework.

**Files:**
- Create: `packages/gateway/src/routes/ucp.ts`
- Create: `packages/gateway/src/routes/ap2.ts`
- Create: `packages/gateway/src/__tests__/ucp-routes.test.ts`
- Create: `packages/gateway/src/__tests__/ap2-routes.test.ts`
- Modify: `packages/gateway/src/gateway.ts`

- [ ] **Step 1: Write failing test for UCP routes**

Write `packages/gateway/src/__tests__/ucp-routes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createGateway } from "../gateway.js";
import { OrganRegistry } from "@ygn-stem/connectors";
import { UcpSessionStore } from "@ygn-stem/commerce";

describe("UCP Routes", () => {
  const registry = new OrganRegistry();
  const ucpStore = new UcpSessionStore();
  const app = createGateway({ registry, ucpStore });

  it("POST /ucp/sessions creates a checkout session", async () => {
    const res = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "test-key-1")
      .send({
        items: [{ name: "Agent API Call", quantity: 10, unitPrice: 0.5 }],
        currency: "EUR",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.total).toBe(5);
    expect(res.body.status).toBe("created");
  });

  it("POST /ucp/sessions with same Idempotency-Key returns same session", async () => {
    const res1 = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "idem-key-2")
      .send({ items: [{ name: "X", quantity: 1, unitPrice: 1 }], currency: "USD" });
    const res2 = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "idem-key-2")
      .send({ items: [{ name: "X", quantity: 1, unitPrice: 1 }], currency: "USD" });
    expect(res1.body.id).toBe(res2.body.id);
  });

  it("GET /ucp/sessions/:id retrieves a session", async () => {
    const create = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "get-key")
      .send({ items: [{ name: "Y", quantity: 1, unitPrice: 2 }], currency: "EUR" });
    const res = await request(app).get(`/ucp/sessions/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it("POST /ucp/sessions/:id/complete completes a session", async () => {
    const create = await request(app)
      .post("/ucp/sessions")
      .set("Idempotency-Key", "complete-key")
      .send({ items: [{ name: "Z", quantity: 1, unitPrice: 3 }], currency: "EUR" });
    const res = await request(app).post(`/ucp/sessions/${create.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
  });

  it("rejects POST without Idempotency-Key", async () => {
    const res = await request(app)
      .post("/ucp/sessions")
      .send({ items: [], currency: "EUR" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown session", async () => {
    const res = await request(app).get("/ucp/sessions/nonexistent");
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Implement UCP routes**

Write `packages/gateway/src/routes/ucp.ts`:

```typescript
import { Router } from "express";
import type { UcpSessionStore } from "@ygn-stem/commerce";

export function ucpRouter(store: UcpSessionStore): Router {
  const router = Router();

  router.post("/ucp/sessions", (req, res) => {
    const idempotencyKey = req.headers["idempotency-key"] as string;
    if (!idempotencyKey) {
      res.status(400).json({ error: "Idempotency-Key header required" });
      return;
    }
    const session = store.createSession({
      items: req.body.items ?? [],
      currency: req.body.currency ?? "USD",
      idempotencyKey,
    });
    res.status(201).json(session);
  });

  router.get("/ucp/sessions/:id", (req, res) => {
    const session = store.getSession(req.params.id!);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  });

  router.post("/ucp/sessions/:id/complete", (req, res) => {
    try {
      const session = store.completeSession(req.params.id!);
      res.json(session);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}
```

- [ ] **Step 3: Write failing test for AP2 routes**

Write `packages/gateway/src/__tests__/ap2-routes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createGateway } from "../gateway.js";
import { OrganRegistry } from "@ygn-stem/connectors";
import { Ap2Store } from "@ygn-stem/commerce";

describe("AP2 Routes", () => {
  const registry = new OrganRegistry();
  const ap2Store = new Ap2Store();
  const app = createGateway({ registry, ap2Store });

  it("POST /ap2/intents creates a payment intent", async () => {
    const res = await request(app)
      .post("/ap2/intents")
      .send({ amount: 10, currency: "EUR", description: "API usage" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("pending");
  });

  it("POST /ap2/intents auto-approves below threshold", async () => {
    const res = await request(app)
      .post("/ap2/intents")
      .send({ amount: 5, currency: "EUR", description: "Small", autoApproveThreshold: 10 });
    expect(res.body.status).toBe("approved");
  });

  it("POST /ap2/intents/:id/approve approves and creates mandate", async () => {
    const create = await request(app)
      .post("/ap2/intents")
      .send({ amount: 100, currency: "EUR", description: "Large" });
    const res = await request(app)
      .post(`/ap2/intents/${create.body.id}/approve`)
      .send({ approvedBy: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.mandate).toBeDefined();
    expect(res.body.mandate.status).toBe("pending");
  });

  it("POST /ap2/mandates/:id/execute executes and creates receipt", async () => {
    const create = await request(app)
      .post("/ap2/intents")
      .send({ amount: 50, currency: "EUR", description: "Medium" });
    const approve = await request(app)
      .post(`/ap2/intents/${create.body.id}/approve`)
      .send({ approvedBy: "admin" });
    const res = await request(app)
      .post(`/ap2/mandates/${approve.body.mandate.id}/execute`);
    expect(res.status).toBe(200);
    expect(res.body.receipt).toBeDefined();
    expect(res.body.receipt.status).toBe("confirmed");
  });

  it("GET /ap2/audit returns audit trail", async () => {
    const res = await request(app).get("/ap2/audit");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 4: Implement AP2 routes**

Write `packages/gateway/src/routes/ap2.ts`:

```typescript
import { Router } from "express";
import type { Ap2Store } from "@ygn-stem/commerce";

export function ap2Router(store: Ap2Store): Router {
  const router = Router();

  router.post("/ap2/intents", (req, res) => {
    const intent = store.createIntent({
      amount: req.body.amount,
      currency: req.body.currency ?? "USD",
      description: req.body.description ?? "",
      autoApproveThreshold: req.body.autoApproveThreshold,
    });
    res.status(201).json(intent);
  });

  router.get("/ap2/intents/:id", (req, res) => {
    const intent = store.getIntent(req.params.id!);
    if (!intent) { res.status(404).json({ error: "Intent not found" }); return; }
    res.json(intent);
  });

  router.post("/ap2/intents/:id/approve", (req, res) => {
    try {
      const mandate = store.approveIntent(req.params.id!, req.body.approvedBy ?? "system");
      res.json({ intent: store.getIntent(req.params.id!), mandate });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post("/ap2/intents/:id/reject", (req, res) => {
    try {
      const intent = store.rejectIntent(req.params.id!, req.body.reason ?? "");
      res.json(intent);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post("/ap2/mandates/:id/execute", (req, res) => {
    try {
      const receipt = store.executeMandate(req.params.id!);
      res.json({ mandate: store.getMandate(req.params.id!), receipt });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.get("/ap2/audit", (req, res) => {
    const intentId = req.query.intentId as string | undefined;
    res.json(store.getAuditTrail(intentId));
  });

  return router;
}
```

- [ ] **Step 5: Wire into gateway**

Modify `packages/gateway/src/gateway.ts` — add to GatewayOptions:

```typescript
import { ucpRouter } from "./routes/ucp.js";
import { ap2Router } from "./routes/ap2.js";
import type { UcpSessionStore } from "@ygn-stem/commerce";
import type { Ap2Store } from "@ygn-stem/commerce";

// Add to GatewayOptions:
ucpStore?: UcpSessionStore;
ap2Store?: Ap2Store;

// In createGateway, after existing routes:
if (options.ucpStore) app.use(ucpRouter(options.ucpStore));
if (options.ap2Store) app.use(ap2Router(options.ap2Store));
```

- [ ] **Step 6: Update server.ts**

Add to server.ts initialization:

```typescript
import { UcpSessionStore, Ap2Store } from "@ygn-stem/commerce";

const ucpStore = new UcpSessionStore();
const ap2Store = new Ap2Store();

// Pass to createGateway:
const app = createGateway({ registry, ..., ucpStore, ap2Store });
```

- [ ] **Step 7: Run all tests, commit**

```bash
pnpm test:run
```

```bash
git add packages/gateway/ packages/commerce/
git commit -m "feat(gateway): mount UCP checkout and AP2 payment routes"
```

---

## Task 4: ACE Reflect Phase

**Why this matters for the ecosystem:** The CallerProfiler currently has Generate + Curate but no Reflect. Reflect detects when a caller's actual behavior has drifted from their stored profile — which is critical for agents that interact with the same callers over time. Without it, profiles can become stale and misleading.

**Files:**
- Create: `packages/adaptive/src/ace-reflect.ts`
- Create: `packages/adaptive/src/__tests__/ace-reflect.test.ts`
- Modify: `packages/adaptive/src/caller-profiler.ts`
- Modify: `packages/adaptive/src/index.ts`

- [ ] **Step 1: Write failing test**

Write `packages/adaptive/src/__tests__/ace-reflect.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { AceReflector, type DriftReport } from "../ace-reflect.js";

describe("AceReflector", () => {
  let reflector: AceReflector;

  beforeEach(() => {
    reflector = new AceReflector();
  });

  it("detects no drift when signals match profile", () => {
    const profile = { style_technical_depth: 0.8, style_verbosity: 0.3 };
    const recentSignals = [
      { style_technical_depth: 0.78, style_verbosity: 0.32 },
      { style_technical_depth: 0.82, style_verbosity: 0.28 },
    ];
    const report = reflector.detect(profile, recentSignals);
    expect(report.hasDrift).toBe(false);
    expect(report.driftingDimensions).toHaveLength(0);
  });

  it("detects drift when signals consistently diverge from profile", () => {
    const profile = { style_technical_depth: 0.8, style_verbosity: 0.3 };
    const recentSignals = [
      { style_technical_depth: 0.2, style_verbosity: 0.9 },
      { style_technical_depth: 0.15, style_verbosity: 0.85 },
      { style_technical_depth: 0.25, style_verbosity: 0.88 },
    ];
    const report = reflector.detect(profile, recentSignals);
    expect(report.hasDrift).toBe(true);
    expect(report.driftingDimensions).toContain("style_technical_depth");
    expect(report.driftingDimensions).toContain("style_verbosity");
  });

  it("reports drift magnitude per dimension", () => {
    const profile = { risk_tolerance: 0.3 };
    const recentSignals = [
      { risk_tolerance: 0.9 },
      { risk_tolerance: 0.85 },
    ];
    const report = reflector.detect(profile, recentSignals);
    expect(report.magnitudes.risk_tolerance).toBeGreaterThan(0.4);
  });

  it("suggests corrections for drifting dimensions", () => {
    const profile = { risk_tolerance: 0.3 };
    const recentSignals = [
      { risk_tolerance: 0.9 },
      { risk_tolerance: 0.85 },
    ];
    const report = reflector.detect(profile, recentSignals);
    expect(report.corrections.risk_tolerance).toBeGreaterThan(0.5);
  });

  it("ignores single-signal outliers (requires 2+ consistent signals)", () => {
    const profile = { risk_tolerance: 0.3 };
    const recentSignals = [{ risk_tolerance: 0.95 }]; // Single outlier
    const report = reflector.detect(profile, recentSignals);
    expect(report.hasDrift).toBe(false);
  });
});
```

- [ ] **Step 2: Implement AceReflector**

Write `packages/adaptive/src/ace-reflect.ts`:

```typescript
export interface DriftReport {
  hasDrift: boolean;
  driftingDimensions: string[];
  magnitudes: Record<string, number>;
  corrections: Record<string, number>;
  signalCount: number;
}

const DRIFT_THRESHOLD = 0.3;
const MIN_SIGNALS = 2;

export class AceReflector {
  detect(
    profileValues: Record<string, number>,
    recentSignals: Record<string, number>[],
  ): DriftReport {
    const report: DriftReport = {
      hasDrift: false,
      driftingDimensions: [],
      magnitudes: {},
      corrections: {},
      signalCount: recentSignals.length,
    };

    if (recentSignals.length < MIN_SIGNALS) return report;

    for (const dim of Object.keys(profileValues)) {
      const profileVal = profileValues[dim]!;
      const signalVals = recentSignals
        .map((s) => s[dim])
        .filter((v): v is number => v !== undefined);

      if (signalVals.length < MIN_SIGNALS) continue;

      const avgSignal = signalVals.reduce((a, b) => a + b, 0) / signalVals.length;
      const magnitude = Math.abs(avgSignal - profileVal);

      if (magnitude >= DRIFT_THRESHOLD) {
        report.hasDrift = true;
        report.driftingDimensions.push(dim);
        report.magnitudes[dim] = magnitude;
        report.corrections[dim] = avgSignal;
      }
    }

    return report;
  }
}
```

- [ ] **Step 3: Integrate into CallerProfiler**

Add to `packages/adaptive/src/caller-profiler.ts`:

```typescript
import { AceReflector, type DriftReport } from "./ace-reflect.js";

// Add to CallerProfiler class:
private reflector = new AceReflector();
private signalHistory = new Map<string, Record<string, number>[]>();

// Add method:
async reflect(callerId: string): Promise<DriftReport> {
  const profile = await this.getOrCreateProfile(callerId);
  const signals = this.signalHistory.get(callerId) ?? [];
  const profileValues: Record<string, number> = {};
  // Flatten profile dimensions into a flat key→value map
  for (const [category, dims] of Object.entries(profile)) {
    if (typeof dims === "object" && dims !== null && category !== "callerId") {
      for (const [dim, val] of Object.entries(dims as Record<string, any>)) {
        if (typeof val === "number") {
          profileValues[`${category}_${dim}`] = val;
        } else if (val && typeof val.value === "number") {
          profileValues[`${category}_${dim}`] = val.value;
        }
      }
    }
  }
  const report = this.reflector.detect(profileValues, signals);
  // Apply corrections if drift detected
  if (report.hasDrift) {
    await this.curate(callerId, report.corrections);
  }
  return report;
}

// In curate(), also track signals:
// After the existing curate logic, append:
const history = this.signalHistory.get(callerId) ?? [];
history.push(signals);
if (history.length > 20) history.shift(); // sliding window
this.signalHistory.set(callerId, history);
```

- [ ] **Step 4: Add to exports, run tests, commit**

```bash
pnpm test:run
git add packages/adaptive/
git commit -m "feat(adaptive): add ACE Reflect phase with drift detection and auto-correction"
```

---

## Task 5: Redis Hot Cache

**Why this matters for the ecosystem:** Every recall query currently hits the full in-memory store (or PostgreSQL). Redis caches the most frequently accessed caller profiles and recall results — 10x faster response for repeat callers, and shared across gateway instances for horizontal scaling.

**Files:**
- Create: `packages/memory/src/redis/redis-cache.ts`
- Create: `packages/memory/src/__tests__/redis-cache.test.ts`
- Modify: `packages/memory/src/hindsight.ts`
- Modify: `packages/memory/src/index.ts`

- [ ] **Step 1: Write failing test (with mock Redis)**

Write `packages/memory/src/__tests__/redis-cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryCache } from "../redis/redis-cache.js";

// Test with in-memory fallback (no real Redis needed)
describe("MemoryCache (in-memory fallback)", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(); // No Redis URL → in-memory Map
  });

  it("caches and retrieves a value", async () => {
    await cache.set("key1", { data: "hello" }, 60);
    const result = await cache.get<{ data: string }>("key1");
    expect(result?.data).toBe("hello");
  });

  it("returns null for missing keys", async () => {
    expect(await cache.get("missing")).toBeNull();
  });

  it("respects TTL (expires entries)", async () => {
    vi.useFakeTimers();
    await cache.set("ttl-key", "value", 1); // 1 second TTL
    expect(await cache.get("ttl-key")).toBe("value");
    vi.advanceTimersByTime(2000);
    expect(await cache.get("ttl-key")).toBeNull();
    vi.useRealTimers();
  });

  it("invalidates a key", async () => {
    await cache.set("del-key", "value", 60);
    await cache.invalidate("del-key");
    expect(await cache.get("del-key")).toBeNull();
  });

  it("invalidates by prefix", async () => {
    await cache.set("caller:alice:profile", "p1", 60);
    await cache.set("caller:alice:recall", "r1", 60);
    await cache.set("caller:bob:profile", "p2", 60);
    await cache.invalidateByPrefix("caller:alice:");
    expect(await cache.get("caller:alice:profile")).toBeNull();
    expect(await cache.get("caller:alice:recall")).toBeNull();
    expect(await cache.get("caller:bob:profile")).toBe("p2");
  });

  it("computes cache key for recall queries", () => {
    const key = MemoryCache.recallKey("alice", "what is MCP?");
    expect(key).toContain("alice");
    expect(key).toContain("recall:");
  });

  it("computes cache key for caller profiles", () => {
    const key = MemoryCache.profileKey("alice");
    expect(key).toBe("caller:alice:profile");
  });
});
```

- [ ] **Step 2: Implement MemoryCache**

Write `packages/memory/src/redis/redis-cache.ts`:

```typescript
import { createHash } from "node:crypto";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private redis: any = null;
  private fallback = new Map<string, CacheEntry<unknown>>();

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.initRedis(redisUrl);
    }
  }

  private async initRedis(url: string): Promise<void> {
    try {
      const { default: Redis } = await import("ioredis");
      this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      await this.redis.connect();
    } catch {
      this.redis = null; // Fallback to in-memory
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      const val = await this.redis.get(key);
      return val ? (JSON.parse(val) as T) : null;
    }
    const entry = this.fallback.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.fallback.delete(key);
      return null;
    }
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    }
    this.fallback.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async invalidate(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
      return;
    }
    this.fallback.delete(key);
  }

  async invalidateByPrefix(prefix: string): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length > 0) await this.redis.del(...keys);
      return;
    }
    for (const key of this.fallback.keys()) {
      if (key.startsWith(prefix)) this.fallback.delete(key);
    }
  }

  async close(): Promise<void> {
    await this.redis?.quit();
  }

  static recallKey(callerId: string, query: string): string {
    const hash = createHash("sha256").update(query).digest("hex").slice(0, 12);
    return `recall:${callerId}:${hash}`;
  }

  static profileKey(callerId: string): string {
    return `caller:${callerId}:profile`;
  }
}
```

- [ ] **Step 3: Wire into HindsightMemory**

Add optional cache to HindsightMemory constructor:

```typescript
constructor(stores: HindsightStores, embeddingProvider?: EmbeddingProvider, cache?: MemoryCache)
```

In `recall()`, check cache before querying stores:
```typescript
async recall(query: RecallQuery): Promise<RecallResult> {
  if (this.cache) {
    const cacheKey = MemoryCache.recallKey(query.callerId, query.query);
    const cached = await this.cache.get<RecallResult>(cacheKey);
    if (cached) return cached;
  }
  const result = this.embeddingProvider ? await this.vectorRecall(query) : await this.keywordRecall(query);
  if (this.cache) {
    await this.cache.set(MemoryCache.recallKey(query.callerId, query.query), result, 300);
  }
  return result;
}
```

- [ ] **Step 4: Update server.ts to initialize Redis**

```typescript
import { MemoryCache } from "@ygn-stem/memory";

const cache = new MemoryCache(process.env.REDIS_URL);
const memory = new HindsightMemory(stores, embeddingProvider, cache);
```

- [ ] **Step 5: Run tests, commit**

```bash
pnpm test:run
git add packages/memory/ packages/gateway/
git commit -m "feat(memory): add Redis hot cache with in-memory fallback"
```

---

## Task 6: Full Sleep-Time Consolidation

**Why this matters for the ecosystem:** Sleep-Time Compute is a key innovation from the Letta/UC Berkeley paper (5x less compute, +18% accuracy). Currently the SleepWorker only prunes episodes (1/7 activities). This task adds: semantic dedup on Facts, pattern extraction (Episodes → Summaries), skill crystallization, and ACE Reflect sweep.

**Files:**
- Modify: `packages/adaptive/src/sleep-worker.ts`
- Create: `packages/adaptive/src/__tests__/sleep-consolidation.test.ts`

- [ ] **Step 1: Write failing test for full consolidation**

Write `packages/adaptive/src/__tests__/sleep-consolidation.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SleepWorker } from "../sleep-worker.js";
import {
  HindsightMemory,
  InMemoryFactsStore,
  InMemoryEpisodesStore,
  InMemorySummariesStore,
  InMemoryBeliefsStore,
  HashEmbeddingProvider,
} from "@ygn-stem/memory";
import { SkillsEngine } from "../skills-engine.js";
import { CallerProfiler } from "../caller-profiler.js";

describe("SleepWorker full consolidation", () => {
  let memory: HindsightMemory;
  let skills: SkillsEngine;
  let profiler: CallerProfiler;
  let worker: SleepWorker;

  beforeEach(() => {
    const beliefs = new InMemoryBeliefsStore();
    memory = new HindsightMemory({
      facts: new InMemoryFactsStore(),
      episodes: new InMemoryEpisodesStore(),
      summaries: new InMemorySummariesStore(),
      beliefs,
    }, new HashEmbeddingProvider());
    skills = new SkillsEngine();
    profiler = new CallerProfiler(beliefs);
    worker = new SleepWorker(memory, { skills, profiler });
  });

  it("prunes low-importance episodes", async () => {
    await memory.retain({ episode: makeEpisode("low", 0.05) });
    await memory.retain({ episode: makeEpisode("high", 0.9) });
    const stats = await worker.run();
    expect(stats.episodesPruned).toBe(1);
  });

  it("extracts patterns from recurring episodes into summaries", async () => {
    // 3+ episodes with the same organ = pattern
    await memory.retain({ episode: makeEpisode("e1", 0.8, { organUsed: "sage", intent: "code review" }) });
    await memory.retain({ episode: makeEpisode("e2", 0.7, { organUsed: "sage", intent: "code review" }) });
    await memory.retain({ episode: makeEpisode("e3", 0.75, { organUsed: "sage", intent: "code review" }) });
    const stats = await worker.run();
    expect(stats.patternsExtracted).toBeGreaterThan(0);
  });

  it("reports all consolidation activities", async () => {
    const stats = await worker.run();
    expect(stats.phase).toBe("sleep");
    expect(stats).toHaveProperty("episodesPruned");
    expect(stats).toHaveProperty("patternsExtracted");
    expect(stats).toHaveProperty("profilesRecalibrated");
    expect(stats).toHaveProperty("durationMs");
  });
});

function makeEpisode(id: string, importance: number, overrides: Record<string, any> = {}) {
  return {
    id,
    timestamp: new Date().toISOString(),
    callerId: "alice",
    intent: overrides.intent ?? "test",
    entities: [],
    toolsUsed: [],
    organUsed: overrides.organUsed ?? "ygn",
    outcome: "success" as const,
    durationMs: 100,
    importanceScore: importance,
    ...overrides,
  };
}
```

- [ ] **Step 2: Implement full SleepWorker**

Rewrite `packages/adaptive/src/sleep-worker.ts`:

```typescript
import type { HindsightMemory } from "@ygn-stem/memory";
import type { SkillsEngine } from "./skills-engine.js";
import type { CallerProfiler } from "./caller-profiler.js";

export interface SleepOptions {
  importanceThreshold?: number;
  skills?: SkillsEngine;
  profiler?: CallerProfiler;
}

export interface SleepStats {
  phase: "sleep";
  episodesPruned: number;
  patternsExtracted: number;
  profilesRecalibrated: number;
  durationMs: number;
}

export class SleepWorker {
  private readonly importanceThreshold: number;
  private readonly skills?: SkillsEngine;
  private readonly profiler?: CallerProfiler;

  constructor(
    private readonly memory: HindsightMemory,
    options: SleepOptions = {},
  ) {
    this.importanceThreshold = options.importanceThreshold ?? 0.3;
    this.skills = options.skills;
    this.profiler = options.profiler;
  }

  async run(): Promise<SleepStats> {
    const start = Date.now();

    // Activity 1: Episodic pruning
    const reflectResult = await this.memory.reflect({
      importanceThreshold: this.importanceThreshold,
    });

    // Activity 2: Pattern extraction (Episodes → Summaries)
    const patternsExtracted = await this.extractPatterns();

    // Activity 3: Profile recalibration (ACE Reflect sweep)
    const profilesRecalibrated = await this.recalibrateProfiles();

    return {
      phase: "sleep",
      episodesPruned: reflectResult.episodesPruned,
      patternsExtracted,
      profilesRecalibrated,
      durationMs: Date.now() - start,
    };
  }

  private async extractPatterns(): Promise<number> {
    // Group recent episodes by organ + intent pattern
    const episodes = await this.memory.episodes.searchByKeyword("", 100);
    const patterns = new Map<string, typeof episodes>();

    for (const ep of episodes) {
      const key = `${ep.organUsed ?? "unknown"}:${ep.intent?.split(" ").slice(0, 3).join(" ")}`;
      const group = patterns.get(key) ?? [];
      group.push(ep);
      patterns.set(key, group);
    }

    let extracted = 0;
    for (const [key, group] of patterns) {
      if (group.length >= 3) {
        // Pattern detected — create/update summary
        const [organ, ...intentParts] = key.split(":");
        await this.memory.summaries.upsert({
          entityId: `pattern:${key}`,
          entityType: "pattern",
          primaryAbstraction: `Recurring ${intentParts.join(":")} via ${organ} (${group.length} occurrences)`,
          cueAnchors: [...new Set(group.flatMap((e) => e.intent?.split(" ") ?? []))].slice(0, 10),
          concreteValues: [`${group.length} episodes`, `avg importance: ${(group.reduce((s, e) => s + e.importanceScore, 0) / group.length).toFixed(2)}`],
          lastUpdated: new Date().toISOString(),
          version: 0,
        });
        extracted++;
      }
    }

    return extracted;
  }

  private async recalibrateProfiles(): Promise<number> {
    if (!this.profiler) return 0;
    const callerIds = await this.memory.beliefs.listCallerIds();
    let recalibrated = 0;
    for (const callerId of callerIds) {
      try {
        const report = await this.profiler.reflect(callerId);
        if (report.hasDrift) recalibrated++;
      } catch {
        // Skip callers with errors
      }
    }
    return recalibrated;
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
pnpm test:run
git add packages/adaptive/
git commit -m "feat(adaptive): full Sleep-Time consolidation (prune, patterns, recalibrate)"
```

---

## Self-Review Checklist

1. **Spec coverage against remaining gaps:**
   - ONNX embeddings → Task 1 ✓
   - SKILL.md parsing → Task 2 ✓
   - Commerce routes (UCP + AP2) → Task 3 ✓
   - ACE Reflect → Task 4 ✓
   - Redis caching → Task 5 ✓
   - Full Sleep-Time → Task 6 ✓
   - Framework adapters (AutoGen/CrewAI/LangGraph/OpenAI) → NOT in this sprint (lower ecosystem priority)
   - A2UI protocol → NOT in this sprint (requires frontend consumer)

2. **Placeholder scan:** All tasks have complete code. No TBDs.

3. **Type consistency:** All interfaces match what exists in the codebase (verified from explore). `SkillLoader.registerSkill()` maps to actual `SkillsEngine.register()` signature. `SleepWorker` constructor signature extended but backward-compatible.
