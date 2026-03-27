# YGN-STEM: Adaptive Agent Fabric — Design Specification

**Date**: 2026-03-27
**Status**: Approved (all 4 layers validated)
**Author**: Yann Abadie + Claude Opus 4.6
**Based on**: arXiv:2603.22359 (STEM Agent), enhanced with SOTA March 2026

---

## 1. Purpose

YGN-STEM is the **interoperability and adaptive intelligence layer** of the YGN ecosystem. It does not duplicate reasoning, execution, verification, or governance — those live in existing repos. It connects, adapts, memorizes, and orchestrates.

### What YGN-STEM does (unique value):
- **Adapts** — learns caller preferences via ACE Context Engineering (Caller Profiler)
- **Chooses** — selects optimal agent architecture per task (Architecture Selector)
- **Connects** — exposes 6 standardized protocols to the world (Protocol Gateway)
- **Memorizes** — federated cross-repo memory with 4 logical networks (Hindsight Memory)
- **Evolves** — portable skills that improve via group evolution (Skills Engine)
- **Consolidates** — idle-time pre-analysis between sessions (Sleep-Time Compute)

### What YGN-STEM does NOT do:
- Cognitive reasoning (delegated to Y-GN HiveMind / SAGE pipeline)
- Tool execution in sandbox (delegated to Y-GN Core / SAGE Wasm)
- Security guards (delegated to Meta-YGN Guard Pipeline)
- Formal verification (delegated to SAGE Z3/SMT)
- Cryptographic proof (delegated to YGN-VM Aletheia)
- Knowledge scraping (delegated to YGN-FINANCE pipeline)

### Design constraint:
YGN-STEM is a **brick** in a future unified project. It must be modular, composable, and make zero assumptions about the final product form. Every component has value both independently and composed.

---

## 2. Architecture Overview

4-layer architecture with organ connectors:

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1 — PROTOCOL GATEWAY (Express.js 5)          │
│  A2A v0.3 | AG-UI | A2UI | MCP | UCP | AP2         │
│  + Auth middleware + Rate limiter + Evidence capture │
├─────────────────────────────────────────────────────┤
│  LAYER 2 — ADAPTIVE INTELLIGENCE                    │
│  Caller Profiler | Architecture Selector            │
│  Skills Engine   | Sleep-Time Compute               │
├─────────────────────────────────────────────────────┤
│  LAYER 3 — HINDSIGHT MEMORY                         │
│  Facts | Experiences | Summaries | Beliefs          │
│  Retain / Recall / Reflect operations               │
├─────────────────────────────────────────────────────┤
│  LAYER 4 — ORGAN CONNECTORS                         │
│  Y-GN | SAGE | Meta-YGN | YGN-VM | YGN-FINANCE     │
│  + nexus-evidence | KodoClaw | future organs        │
└─────────────────────────────────────────────────────┘
```

---

## 3. Layer 1 — Protocol Gateway

### 3.1 Protocols

| Protocol | Route | Transport | Spec |
|----------|-------|-----------|------|
| A2A v0.3 | `POST /a2a`, `GET /.well-known/agent.json` | JSON-RPC 2.0, SSE, gRPC | Linux Foundation |
| AG-UI | `GET /ag-ui/stream` | SSE | CopilotKit |
| A2UI | `POST /a2ui/render`, `POST /a2ui/action` | JSON | Google spec |
| MCP | `POST /mcp` | Streamable HTTP + stdio | AAIF / Linux Foundation |
| UCP | `POST /ucp/sessions`, `POST /ucp/sessions/:id/complete`, `GET /ucp/sessions/:id` | JSON, Idempotency-Key headers | Novel (from paper) |
| AP2 | `POST /ap2/intents`, `POST /ap2/mandates`, `POST /ap2/receipts` | JSON | Novel (from paper) |

### 3.2 Middleware Pipeline (sequential)

1. **Request ID** — UUID v7 correlation ID on every request
2. **Auth** — JWT, OAuth2, API Key providers (pluggable via strategy pattern)
3. **Rate Limiter** — Token-bucket per-caller, configurable per-protocol
4. **Caller Identify** — Extract caller_id from auth, attach to request context
5. **Request Log** — Structured JSON logging with request/response pairs
6. **Evidence Capture** — Pipe request events to YGN-VM connector (async, non-blocking)

### 3.3 Framework Adapters

4 adapters translate external framework conventions into internal format:
- AutoGen adapter
- CrewAI adapter
- LangGraph adapter
- OpenAI Agents SDK adapter

Each adapter implements a `createRouter()` pattern, mounted on the gateway.

### 3.4 MCP Tool Aggregation

The gateway connects to all organs via their MCP interfaces and exposes their tools in a **unified namespace**:

```
tools/list → [
  ygn.orchestrate, ygn.guard_check, ygn.swarm_execute, ...
  sage.run_task, sage.topology_generate, sage.knn_route, ...
  metacog.classify, metacog.verify, metacog.recall, ...
  aletheia.capture, aletheia.seal, aletheia.verify, ...
  evidence.review_pr, evidence.get_evidence, ...
]
```

Tool discovery is on-demand (Tool Search pattern from Anthropic) to avoid context window bloat.

### 3.5 REST + WebSocket

- `GET /health` — Service health + organ connectivity status
- `GET /organs` — List connected organs with capabilities
- `GET /metrics` — Memory stats, caller counts, protocol usage
- WebSocket at `/ws` for real-time event streaming

---

## 4. Layer 2 — Adaptive Intelligence

### 4.1 Caller Profiler (ACE-enhanced)

**Purpose**: Learn and adapt to each caller's behavioral preferences.

**21 dimensions across 4 categories**:

| Category | Dimensions | Count |
|----------|-----------|-------|
| Philosophy | pragmatism↔idealism, risk_tolerance, innovation_orientation, detail_focus↔big_picture, speed↔thoroughness, collaboration↔autonomy, consistency↔experimentation, simplicity↔completeness | 8 |
| Principles | correctness_over_speed, testing_emphasis, security_mindedness, code_quality_priority | 4 |
| Style | formality_level, verbosity_preference, technical_depth, structure_preference, communication_pattern | 5 |
| Habits | session_length_pattern, iteration_tendency, peak_activity_hours, preferred_interaction_mode | 4 |

**Learning mechanism**: ACE Context Engineering (ICLR 2026) replaces simple EMA:
- **Generate**: Extract behavioral signals from current interaction
- **Reflect**: Evaluate whether accumulated profile diverges from observed behavior
- **Curate**: Revise profile without losing nuanced insights (anti context-collapse)

**Confidence gating**: `conf(n) = n / (n + κ)`, κ=10. Below n=5 (conf≈0.33), system primarily uses current message signals. As confidence grows, learned profile dominates.

**Storage**: Beliefs network (Layer 3). GDPR forget-me: complete purge by caller_id.

### 4.2 Architecture Selector

**Purpose**: Choose the optimal agent architecture for each task, based on Google Scaling Science (87% accuracy, 180 configs tested).

**Input: Task property analysis**:
- Sequential dependencies (yes/no)
- Tool density (count of tools likely needed)
- Parallelizability (subtask independence)
- Complexity (via SAGE kNN if available, else heuristic)
- Domain count (single vs multi)
- Caller history (from profiler)

**Decision matrix**:

| Task Properties | Architecture | Organ Routing |
|----------------|-------------|---------------|
| Sequential + simple | Single agent | Y-GN direct (MCP) |
| Parallelizable + multi-domain | Centralized multi-agent | SAGE topology engine (A2A) |
| High criticality | Adversarial RedBlue | Y-GN swarm mode + Meta-YGN oversight |
| Formal verification needed | SMT pipeline | SAGE Z3 + YGN-VM evidence |
| Research / knowledge | Knowledge pipeline | SAGE ExoCortex + YGN-FINANCE |
| Simple Q&A | Direct LLM | Y-GN single call |

**Safety**: Architecture Selector never self-evolves in isolation. All adaptation is supervised by Meta-YGN (external oversight), complying with the Self-Evolution Trilemma (February 2026).

### 4.3 Skills Engine

**Format**: Agent Skills standard (SKILL.md) — the open standard adopted by Anthropic and OpenAI (62K+ GitHub stars).

```yaml
---
name: code-review-rust
description: Review Rust code for safety and correctness
triggers: [rust, review, unsafe, clippy]
maturity: committed  # progenitor | committed | mature
activations: 7
success_rate: 0.85
organs: [sage, metacog]
---

# Instructions
1. Classify risk with metacog.classify
2. Run sage.run_task with review prompt
3. Cross-validate with metacog.verify
4. Capture evidence via aletheia
```

**Maturity lifecycle** (from paper, enhanced):
- **Progenitor**: Crystallized from ≥3 recurring episode patterns. Not eligible for pipeline shortcutting.
- **Committed**: After 3 successful activations with ≥60% success rate. Can short-circuit reasoning/planning.
- **Mature**: After 10 successful activations with ≥60% success rate. Maximum matching priority.
- **Apoptosis**: ≥10 activations with <30% success rate → deleted.
- **Plugin skills**: Manual registration, bypass crystallization.

**GEA Group Evolution** (vs paper's isolated evolution):
- Skills discovered by one agent are tested by other agents (cross-validation)
- Experience sharing across agents accelerates maturation
- Collective mutation: best skill → cloned mutants tested in parallel
- Result: 71% SWE-bench Verified (vs 56.7% isolated evolution)

**Storage**: PostgreSQL (persistent, not in-memory like the paper).

### 4.4 Sleep-Time Compute

**Purpose**: Pre-analyze and consolidate between sessions. 5x less inference compute, +18% accuracy (Letta/UC Berkeley 2025).

**3 phases**:

| Phase | Trigger | Activities |
|-------|---------|-----------|
| **Active** | User sessions | Normal pipeline processing, episode storage, profile updates |
| **Sleep** | Session-end hook or cron | Memory consolidation (episodic pruning, semantic dedup, pattern extraction), skill crystallization (GEA cross-validation), profile calibration (ACE curation pass, drift detection), pre-computation (embeddings, recall indexes) |
| **Wake** | Next session start | Pre-loaded context, refined skills, calibrated profiles, 5x faster response |

**Implementation**: Cron job or session-end triggered worker. Compute budget enforced to prevent cost spirals.

---

## 5. Layer 3 — Hindsight Memory

### 5.1 Four Logical Networks

Inspired by Hindsight (39%→91.4% accuracy), Memora (cue anchors, SOTA LoCoMo), CraniMem (neurocognitive consolidation), xMemory (latent component retrieval).

#### 5.1.1 Facts Network
- **Content**: Objective, verified knowledge as triples (Subject, Predicate, Object)
- **Schema**: `{ id, subject, predicate, object, confidence, source_organ, created_at, updated_at, embedding }`
- **Deduplication**: Automatic merge of semantically redundant triples
- **Versioning**: Each triple carries timestamp + confidence score
- **Fed by**: Consolidated episodes, tool results, repo documentation

#### 5.1.2 Experiences Network
- **Content**: Concrete interaction episodes
- **Schema**: `{ id, timestamp, caller_id, intent, entities, tools_used, organ_used, outcome, duration_ms, importance_score, embedding }`
- **Importance scoring**: `score = 0.3*novelty + 0.3*outcome_significance + 0.2*caller_rarity + 0.2*tool_count`
- **Indexing**: HNSW (pgvector) + time-range + caller_id + organ
- **Pruning**: Sleep-time, by importance_score threshold
- **Fed by**: Every processed request → 1 episode

#### 5.1.3 Summaries Network
- **Content**: Entity abstractions that evolve over time
- **Schema**: `{ entity_id, entity_type, primary_abstraction, cue_anchors[], concrete_values[], last_updated, version }`
- **Cue anchors** (Memora innovation): Keywords/concepts that expand retrieval beyond semantic similarity
- **Evolution**: A-MEM (Zettelkasten-inspired) — new memories trigger updates to related summaries
- **Fed by**: Sleep-time consolidation (Experiences → Summaries)

#### 5.1.4 Beliefs Network
- **Content**: Subjective, per-caller preferences and strategies
- **Schema**: `{ caller_id, profile_dimensions{}, preferred_strategies{}, organ_preferences{}, skill_success_rates{}, behavioral_predictions{}, last_updated }`
- **Update**: ACE (Generate/Reflect/Curate), not simple EMA
- **Isolation**: Strictly per-caller, never shared across callers
- **GDPR**: forget-me → complete purge by caller_id
- **Fed by**: Caller Profiler (Layer 2A) + Learn phase

### 5.2 Three Operations

#### RETAIN (after each interaction)
1. Create episode in Experiences
2. Extract knowledge triples into Facts
3. Update impacted entity summaries in Summaries
4. ACE-update caller profile in Beliefs

#### RECALL (on each incoming request)
1. Load caller profile from Beliefs
2. Retrieve relevant triples from Facts (cosine similarity)
3. Retrieve similar episodes from Experiences (HNSW)
4. Retrieve entity context from Summaries (cue anchor expansion)
5. Fusion via UCB adaptive retrieval: `score = 0.7*cosine + 0.3*(mean_reward + sqrt(2*ln(N)/hits))`

#### REFLECT (sleep-time, between sessions)
1. Episodic pruning (below importance threshold)
2. Semantic deduplication (merge similar triples)
3. Pattern extraction (recurring episodes → summaries)
4. Belief recalibration (drift detection + ACE curation)
5. Cue anchor refresh (Memora)
6. CraniMem-inspired selective transfer: fast store (Experiences) → slow store (Facts/Summaries) via replay

### 5.3 Memory Federation

YGN-STEM does not replace organ memories. It federates them read-only via MCP:

| Organ | Memory System | MCP Interface | Federation Target |
|-------|--------------|---------------|-------------------|
| YGN-SAGE | S-MMU (4-view graph) + ExoCortex | `sage.memory_recall` | Facts + Experiences |
| Y-GN | 3-tier (Hot/Warm/Cold + HippoRAG) | `ygn.memory_recall` | Facts (KG triples) |
| Meta-YGN | Graph Memory (SQLite + FTS5 + UCB) | `metacog.recall` | Summaries (nodes+edges) |

Cross-repo recall uses Reciprocal Rank Fusion (k=60) to merge results from STEM's own memory and federated organ memories.

### 5.4 Tech Stack

- **PostgreSQL 17** + **pgvector**: Primary store for all 4 networks. HNSW indexing, cosineDistance.
- **Redis**: Hot cache (TTL), pub/sub event streaming, rate limit counters.
- **Drizzle ORM**: Type-safe queries with pgvector integration, migration system.
- **Embedding providers** (local-first, zero API dependency):
  - **Primary**: `Snowflake/snowflake-arctic-embed-m` (768d, ONNX) — already used in SAGE, proven, L2-normalized
  - **Scientific docs**: `allenai/specter2_base` (768d) — optimized for research papers and technical documents
  - **Sparse retrieval**: `naver/splade-cocondenser-ensembledistil` — hybrid BM25+dense for Hindsight RECALL
  - **Lightweight fallback**: `all-MiniLM-L6-v2` (384d, ONNX quantized) — for low-resource / edge scenarios
  - **Hash fallback**: Term-frequency hashing into N-dim buckets (zero-model mode)
  - Runtime: `onnxruntime` (already installed) for ONNX models, `sentence-transformers` for safetensors
  - Configurable via `EMBEDDING_PROVIDER` env var. No external API required.

### 5.5 Standalone Mode

When no organs are connected, YGN-STEM still functions as:
- A multi-protocol gateway (responds with capability discovery)
- A memory system (Hindsight 4-network operates independently)
- A caller profiler (learns preferences even without execution organs)
- A skills registry (stores and matches skills, but cannot execute organ-dependent steps)

This ensures the brick has value even before other repos are connected.

---

## 6. Layer 4 — Organ Connectors

### 6.1 Connector Architecture

```
connectors/
├── src/
│   ├── organ-registry.ts       # Central registry: discover, register, health-check
│   ├── base-connector.ts       # ABC: connect(), disconnect(), callTool(), health()
│   ├── circuit-breaker.ts      # 3-state (closed/open/half_open), configurable
│   ├── tool-aggregator.ts      # Merge all organ tools into unified namespace
│   ├── organs/
│   │   ├── ygn-connector.ts    # MCP stdio/HTTP + A2A + uACP
│   │   ├── sage-connector.ts   # MCP HTTP + A2A
│   │   ├── meta-connector.ts   # MCP stdio (rmcp) + HTTP daemon
│   │   ├── vm-connector.ts     # CLI subprocess bridge
│   │   ├── finance-connector.ts# Pipeline trigger + result injection
│   │   └── evidence-connector.ts # MCP (nexus-evidence)
│   └── transports/
│       ├── mcp-stdio.ts        # MCP over stdio (spawn subprocess)
│       ├── mcp-http.ts         # MCP Streamable HTTP client
│       ├── a2a-client.ts       # A2A JSON-RPC + Agent Card discovery
│       ├── uacp-client.ts      # Binary codec (19-byte header)
│       └── cli-bridge.ts       # Generic subprocess stdin/stdout
```

### 6.2 Organ Specifications

#### Y-GN (Runtime Execution)
- **Primary**: MCP stdio — spawn `ygn-core mcp` as subprocess (~1ms latency)
- **Fallback**: MCP HTTP — `POST http://host:3000/mcp` (remote/containerized)
- **Inter-agent**: A2A — `POST /a2a` for cross-instance orchestration
- **Edge**: uACP — binary protocol for constrained nodes
- **Tools**: orchestrate, guard_check, swarm_execute, memory_recall, memory_search_semantic, orchestrate_compiled, orchestrate_refined, evidence_export
- **Used for**: Single-agent execution, swarm multi-mode (6 modes), guard checks, memory federation, evidence export, context compilation

#### YGN-SAGE (Research & Topology)
- **Primary**: MCP Streamable HTTP — `http://host:8001/mcp` (FastMCP/Python)
- **Secondary**: A2A — `http://host:8002/a2a` (Starlette, 3 skills)
- **Tools**: run_task, topology_generate, memory_recall, knn_route, exocortex_search, verify_smt
- **Used for**: Multi-agent complex tasks, topology generation (6-path), kNN routing (92% GT), formal verification Z3/SMT, ExoCortex RAG, S-MMU memory federation

#### Meta-YGN (Governance & Oversight)
- **Primary**: MCP stdio — rmcp-based, fused into daemon process (zero-hop)
- **Secondary**: Daemon HTTP — `http://127.0.0.1:{port}/hooks/*` (16+ route groups)
- **Tools**: metacog.classify, metacog.verify, metacog.recall, metacog.status, metacog.prune
- **Used for**: Trilemma Safety oversight, risk classification pre-routing, verification post-execution, graph memory federation, fatigue/drift detection, heuristic evolution scores
- **Critical role**: External oversight required by Self-Evolution Trilemma

#### YGN-VM (Proof)
- **Interface**: CLI stdin pipe — `events | aletheia capture --session S`
- **Bridge**: TypeScript subprocess wrapper (spawn aletheia, pipe events, collect packs)
- **Commands**: capture (JSONL→receipts), seal (receipts→signed pack), verify (pack→result), export (pack→report)
- **Used for**: Cryptographic evidence of all agent actions, audit trail generation
- **Future**: Native MCP server for aletheia (contribution upstream)

#### YGN-FINANCE (Knowledge)
- **Interface**: Pipeline trigger via subprocess or Python import
- **Pattern**: Scrape → Classify → Score → Store → Push
- **4 scrapers**: arXiv, GitHub, HuggingFace, RSS (extensible via BaseScraper)
- **Used for**: Knowledge ingestion, domain-agnostic by config, results injected into Hindsight Facts
- **Extensibility**: New scrapers via BaseScraper ABC, new domains via config YAML

#### Satellites (optional)
- **nexus-evidence**: MCP server (review_pr, get_evidence). Dual-agent PR review.
- **KodoClaw**: Extractible security kernel (Aho-Corasick scanner, output guard, BM25 search).
- **Future organs**: Any system exposing MCP or A2A. Plug-and-play via OrganRegistry. Auto-discovery via Agent Cards.

### 6.3 Resilience

- **Circuit Breaker**: Per-organ, 3-state (closed/open/half_open). 5 consecutive failures → open → retry after 30s.
- **Graceful degradation**: Each organ absence reduces capabilities but doesn't crash the system.
- **Health checks**: Periodic heartbeat via organ-specific health endpoints.

---

## 7. Monorepo Structure

```
ygn-stem/
├── packages/
│   ├── shared/           # Zod v4 schemas, types, errors, constants
│   ├── gateway/          # Express.js 5 + protocol routers + middleware
│   ├── adaptive/         # Caller Profiler + Architecture Selector + Skills Engine
│   ├── memory/           # Hindsight 4-network + Sleep-Time Compute
│   ├── connectors/       # Organ interfaces (MCP clients, A2A clients, CLI bridges)
│   └── commerce/         # UCP + AP2 protocol handlers
├── skills/               # SKILL.md definitions (Agent Skills standard)
├── docker/               # Dockerfile + compose (postgres/pgvector + redis + stem)
├── docs/                 # Design specs, API docs
├── vitest.config.ts      # Workspace testing (projects pattern, not deprecated workspace)
├── tsconfig.json         # nodenext + strict
└── pnpm-workspace.yaml   # pnpm workspaces
```

### 7.1 Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| TypeScript | 5.8+ | Primary language, `nodenext` module resolution, `strict` mode |
| Express.js | 5.x | Gateway HTTP framework, async error propagation |
| Zod | v4 | Schema validation (aligned with MCP SDK) |
| Vitest | 3+ | Testing (`projects` pattern for monorepo) |
| Drizzle ORM | latest | Type-safe PostgreSQL + pgvector queries |
| PostgreSQL | 17 | Primary persistence (Facts, Experiences, Summaries, Beliefs, Skills) |
| pgvector | latest | HNSW vector indexing, cosineDistance |
| Redis | 7+ | Hot cache, pub/sub, rate limiting |
| pnpm | 9+ | Monorepo workspace management |
| @modelcontextprotocol/sdk | latest | MCP server + client (Zod v4, Streamable HTTP) |
| Docker | latest | Containerized deployment (compose: postgres + redis + stem) |

### 7.2 Key Conventions

- **ESM-native**: `"type": "module"` throughout, `.js` extensions in imports
- **Dependency injection**: All engines receive dependencies via constructors
- **Interface contracts**: `I*` interfaces for all cross-package boundaries
- **Zod at boundaries**: Every external input/output validated via Zod schemas
- **Graceful degradation**: Every organ call wrapped in circuit breaker + try/catch fallback

---

## 8. Request Flow (End-to-End)

```
External caller (AutoGen/CrewAI/LangGraph/OpenAI/direct)
  │
  ▼
[Layer 1] Protocol Gateway
  │ Middleware: RequestID → Auth → RateLimit → CallerIdentify → Log → EvidenceCapture
  │ Protocol router: A2A | AG-UI | A2UI | MCP | UCP | AP2
  │
  ▼
[Layer 2] Adaptive Intelligence
  │ 1. Caller Profiler → load/update profile from Beliefs (ACE)
  │ 2. Skills Engine → check for matching skill (mature/committed = shortcut)
  │ 3. Architecture Selector → analyze task properties → choose organ routing
  │
  ▼
[Layer 3] Hindsight Memory — RECALL
  │ 1. Beliefs → caller profile
  │ 2. Facts → relevant triples
  │ 3. Experiences → similar episodes
  │ 4. Summaries → entity context (cue anchors)
  │ 5. Federated recall from organ memories (RRF)
  │
  ▼
[Layer 4] Organ Connectors — EXECUTE
  │ Route to selected organ(s) via MCP/A2A/CLI:
  │   Y-GN (single/swarm) | SAGE (topology/research) | Meta-YGN (verify)
  │   YGN-VM (evidence) | YGN-FINANCE (knowledge)
  │
  ▼
[Layer 3] Hindsight Memory — RETAIN
  │ 1. Create episode (Experiences)
  │ 2. Extract triples (Facts)
  │ 3. Update summaries (Summaries)
  │ 4. ACE-update profile (Beliefs)
  │
  ▼
[Layer 1] Protocol Gateway — RESPOND
  │ Format response per protocol (JSON-RPC / SSE / UI components)
  │ Evidence capture (async pipe to YGN-VM)
  │
  ▼
External caller receives response
```

---

## 9. Innovation Summary vs STEM Agent Paper

| Aspect | Paper (alfredcs/stem-agent) | YGN-STEM (this design) |
|--------|---------------------------|----------------------|
| Cognitive pipeline | 8-phase, decorative reasoning trace | No own pipeline — delegates to Y-GN/SAGE (already superior) |
| Memory | 4 in-memory stores, basic | Hindsight 4-network (SOTA), federated cross-repos, PostgreSQL+pgvector |
| Caller adaptation | EMA α=0.1 (context collapse risk) | ACE Context Engineering (Generate/Reflect/Curate) |
| Architecture selection | None (always same pipeline) | Google Scaling Science (87% accuracy, task-property based) |
| Skills | In-memory, isolated per agent | SKILL.md standard, persistent PostgreSQL, GEA group evolution |
| Idle-time compute | None | Sleep-Time Compute (5x less inference, +18% accuracy) |
| Protocols | 5 (A2A, AG-UI, A2UI, MCP, UCP+AP2) | Same 6 protocols + MCP Tool Aggregation across organs |
| Security | Basic JWT/OAuth2 | Delegated to Meta-YGN (27 guards) + Trilemma Safety compliance |
| Verification | None | Delegated to SAGE Z3/SMT + YGN-VM crypto evidence |
| Scalability | In-memory maps, no distribution | PostgreSQL + Redis + Docker + circuit breakers |
| Ecosystem | Standalone monolith | Connective tissue for 6+ repos, designed for future fusion |

---

## 10. SOTA References

| Innovation | Source | Application in YGN-STEM |
|-----------|--------|------------------------|
| Hindsight Memory (4 networks) | arXiv:2512.12818 (Dec 2025) | Layer 3 architecture |
| Memora (cue anchors) | arXiv:2602.03315 (Feb 2026) | Summaries network |
| CraniMem (sleep consolidation) | arXiv:2603.15642 (Mar 2026) | Sleep-Time Reflect |
| Sleep-Time Compute | arXiv:2504.13171 (Letta/UCB) | Layer 2D |
| Google Scaling Science | arXiv:2512.08296 (Dec 2025) | Architecture Selector |
| ACE Context Engineering | arXiv:2510.04618 (ICLR 2026) | Caller Profiler |
| GEA Group Evolution | arXiv:2602.04837 (Feb 2026) | Skills Engine |
| Agent Skills Standard | Anthropic (Dec 2025) | SKILL.md format |
| Self-Evolution Trilemma | arXiv:2602.09877 (Feb 2026) | Safety constraint |
| A-MEM (Zettelkasten) | arXiv:2502.12110 (Feb 2025) | Summaries evolution |
| xMemory (latent component) | arXiv:2602.02007 (Feb 2026) | Recall strategy |
| MCP 2026 Roadmap | modelcontextprotocol.io | Gateway + connectors |
| A2A v0.3 | a2aproject/A2A | Protocol handler |
| AG-UI | ag-ui-protocol/ag-ui | Protocol handler |

---

## 11. Deployment

### Docker Compose

```yaml
services:
  stem:
    build: .
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://stem:stem@postgres:5432/stem
      REDIS_URL: redis://redis:6379
  postgres:
    image: pgvector/pgvector:pg17
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    volumes: [redisdata:/data]
volumes:
  pgdata:
  redisdata:
```

### Organ connectivity (configurable)

Organs are discovered via environment variables or auto-discovery (A2A Agent Cards):

```env
YGN_CORE_MCP=stdio:ygn-core mcp
YGN_BRAIN_MCP=http://localhost:3000/mcp
SAGE_MCP=http://localhost:8001/mcp
SAGE_A2A=http://localhost:8002/a2a
META_YGN_MCP=stdio:aletheiad mcp
META_YGN_HTTP=http://127.0.0.1:7700
ALETHEIA_CLI=aletheia
FINANCE_PIPELINE=python -m src.main --once
```

---

## 12. Testing Strategy

- **Unit tests**: All engines, schemas, memory operations, protocol handlers (per-package)
- **Integration tests**: Protocol compliance (A2A JSON-RPC, AG-UI event sequences, UCP idempotency, AP2 audit trails)
- **Connector tests**: Mock organ responses, circuit breaker behavior, tool aggregation
- **Memory tests**: All 4 networks, 3 operations, federation, consolidation
- **E2E tests**: Full request flow through all layers with mock organs
- **Framework**: Vitest with `projects` pattern (not deprecated `workspace`)
- **Coverage**: v8 provider, target >80%
- **Pool**: `threads` for speed, `forks` for isolation on CI
