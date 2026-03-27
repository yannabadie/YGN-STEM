# YGN-STEM: Feature Reference

Complete feature listing organized by architectural layer.

---

## Layer 1 — Protocol Gateway

The gateway is the external face of YGN-STEM, receiving requests from any agent framework or protocol and normalizing them into an internal format for processing.

### 1.1 Protocol Support (6 protocols)

| Protocol | Routes | Transport | Specification |
|---|---|---|---|
| **A2A v0.3** | `POST /a2a`, `GET /.well-known/agent.json` | JSON-RPC 2.0, SSE streaming, gRPC | Linux Foundation A2A Project |
| **AG-UI** | `GET /ag-ui/stream` | Server-Sent Events | CopilotKit AG-UI spec |
| **A2UI** | `POST /a2ui/render`, `POST /a2ui/action` | JSON | Google A2UI specification |
| **MCP** | `POST /mcp` | Streamable HTTP + stdio | AAIF / Linux Foundation MCP 2026 |
| **UCP** | `POST /ucp/sessions`, `POST /ucp/sessions/:id/complete`, `GET /ucp/sessions/:id` | JSON + `Idempotency-Key` headers | Novel (from STEM paper, enhanced) |
| **AP2** | `POST /ap2/intents`, `POST /ap2/mandates`, `POST /ap2/receipts` | JSON | Novel (from STEM paper, enhanced) |

Additional REST endpoints:
- `GET /health` — Service health + per-organ connectivity status
- `GET /organs` — List connected organs with declared capabilities
- `GET /metrics` — Memory network stats, caller counts, protocol usage
- `WebSocket /ws` — Real-time event streaming

### 1.2 Middleware Pipeline (6 stages, ordered)

Every request passes through all six middleware stages in sequence before reaching protocol-specific routing.

| Stage | Middleware | Function |
|---|---|---|
| 1 | **RequestID** | Attach UUID v7 correlation ID to every request and response |
| 2 | **Auth** | Validate credentials (JWT / OAuth2 / API Key — pluggable strategy pattern) |
| 3 | **RateLimit** | Token-bucket rate limiting, per-caller, configurable per-protocol |
| 4 | **CallerIdentify** | Extract `caller_id` from auth context, attach to request object |
| 5 | **Log** | Structured JSON logging of request/response pairs with correlation ID |
| 6 | **EvidenceCapture** | Async pipe of request events to YGN-VM connector (non-blocking) |

### 1.3 Framework Adapters (4 adapters)

Framework adapters translate external agent framework conventions into STEM's internal format and vice versa. Each adapter implements a `createRouter()` pattern mounted on the gateway.

| Adapter | Framework | Translation |
|---|---|---|
| AutoGen adapter | Microsoft AutoGen | AutoGen message format ↔ STEM internal |
| CrewAI adapter | CrewAI | CrewAI task/crew format ↔ STEM internal |
| LangGraph adapter | LangChain LangGraph | LangGraph state/node format ↔ STEM internal |
| OpenAI Agents SDK adapter | OpenAI Agents SDK | OpenAI agent message format ↔ STEM internal |

### 1.4 MCP Tool Aggregation

The gateway connects to all organs via their MCP interfaces and exposes their tools in a **unified namespace** — callers see one consistent tool list regardless of which organ provides the tool.

```
tools/list response (unified namespace):
  ygn.orchestrate
  ygn.guard_check
  ygn.swarm_execute
  ygn.memory_recall
  ygn.memory_search_semantic
  ygn.orchestrate_compiled
  ygn.orchestrate_refined
  ygn.evidence_export

  sage.run_task
  sage.topology_generate
  sage.memory_recall
  sage.knn_route
  sage.exocortex_search
  sage.verify_smt

  metacog.classify
  metacog.verify
  metacog.recall
  metacog.status
  metacog.prune

  aletheia.capture
  aletheia.seal
  aletheia.verify
  aletheia.export

  evidence.review_pr
  evidence.get_evidence
```

Tool discovery uses the **Tool Search pattern** (Anthropic, Dec 2025) — tools are surfaced on-demand to avoid context window bloat when operating in LLM-facing mode.

---

## Layer 2 — Adaptive Intelligence

The adaptive intelligence layer personalizes every request to the caller's profile and routes it to the optimal architecture.

### 2.1 ACE Caller Profiler

**Innovation**: ACE Context Engineering ([arXiv:2510.04618](https://arxiv.org/abs/2510.04618), ICLR 2026) — replaces the simple EMA (α=0.1) used in the base STEM paper, which is susceptible to context collapse.

**21 behavioral dimensions across 4 categories**:

| Category | Dimensions |
|---|---|
| **Philosophy** (8) | pragmatism↔idealism, risk_tolerance, innovation_orientation, detail_focus↔big_picture, speed↔thoroughness, collaboration↔autonomy, consistency↔experimentation, simplicity↔completeness |
| **Principles** (4) | correctness_over_speed, testing_emphasis, security_mindedness, code_quality_priority |
| **Style** (5) | formality_level, verbosity_preference, technical_depth, structure_preference, communication_pattern |
| **Habits** (4) | session_length_pattern, iteration_tendency, peak_activity_hours, preferred_interaction_mode |

**ACE learning cycle** (per interaction):
1. **Generate** — extract behavioral signals from the current interaction
2. **Reflect** — evaluate whether the accumulated profile diverges from observed behavior
3. **Curate** — revise profile without discarding nuanced insights (anti context-collapse)

**Confidence gating**: `conf(n) = n / (n + κ)`, κ=10
- n < 5 (conf ≈ 0.33): current message signals dominate
- n = 10 (conf = 0.50): balanced learned vs. current
- n = 30 (conf = 0.75): learned profile strongly dominates
- n → ∞ (conf → 1.00): full learned profile

**Storage**: Beliefs network (Layer 3), strictly per-caller isolated.

**GDPR support**: Complete profile purge by `caller_id` on forget-me request.

### 2.2 Architecture Selector

**Innovation**: Google Scaling Science ([arXiv:2512.08296](https://arxiv.org/abs/2512.08296), Dec 2025) — 87% accuracy selecting optimal architecture, validated across 180 configurations.

**Task property analysis** (6 inputs):

| Property | Measurement |
|---|---|
| Sequential dependencies | Boolean (detected from task description) |
| Tool density | Count of tools likely required |
| Parallelizability | Subtask independence score |
| Complexity | SAGE kNN routing if available, else heuristic |
| Domain count | Single vs. multi-domain classification |
| Caller history | From Beliefs (Caller Profiler output) |

**Decision matrix** (6 architectures):

| Task Properties | Architecture | Primary Organ |
|---|---|---|
| Sequential + simple | Single agent | Y-GN direct (MCP) |
| Parallelizable + multi-domain | Centralized multi-agent | SAGE topology engine (A2A) |
| High criticality | Adversarial RedBlue | Y-GN swarm + Meta-YGN oversight |
| Formal verification needed | SMT pipeline | SAGE Z3 + YGN-VM evidence |
| Research / knowledge acquisition | Knowledge pipeline | SAGE ExoCortex + YGN-FINANCE |
| Simple Q&A | Direct LLM | Y-GN single call |

**Safety constraint**: Architecture Selector never self-evolves in isolation. All adaptation requires Meta-YGN external oversight (Self-Evolution Trilemma compliance). When Meta-YGN is unavailable, conservative defaults apply.

### 2.3 Skills Engine

**Format**: SKILL.md standard (Agent Skills, Anthropic Dec 2025, 62K+ GitHub stars).

**Skill anatomy**:
```yaml
---
name: code-review-rust
description: Review Rust code for safety and correctness
triggers: [rust, review, unsafe, clippy]
maturity: committed
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

**Maturity lifecycle** (5 states):

| State | Entry Condition | Capability |
|---|---|---|
| **Progenitor** | ≥3 recurring episode patterns crystallized | Registered; not eligible for pipeline shortcutting |
| **Committed** | 3 successful activations, ≥60% success rate | Can short-circuit reasoning/planning phase |
| **Mature** | 10 successful activations, ≥60% success rate | Maximum matching priority, full pipeline shortcut |
| **Apoptosis** | ≥10 activations, <30% success rate | Deleted from registry |
| **Plugin** | Manual registration | Bypasses crystallization; immediately usable |

**GEA Group Evolution** ([arXiv:2602.04837](https://arxiv.org/abs/2602.04837), Feb 2026):
- Skills discovered by one agent are cross-validated by other agents
- Experience sharing across agents accelerates maturation
- Collective mutation: best-performing skill cloned into parallel test variants
- Result: 71% SWE-bench Verified (vs 56.7% with isolated per-agent evolution)

**Storage**: PostgreSQL (persistent across sessions; not in-memory like the base STEM paper).

### 2.4 Sleep-Time Compute

**Innovation**: Sleep-Time Compute ([arXiv:2504.13171](https://arxiv.org/abs/2504.13171), Letta/UC Berkeley 2025) — pre-analysis between sessions yields 5x less inference compute and +18% accuracy on first-response of new sessions.

**Three phases**:

| Phase | Trigger | Activities |
|---|---|---|
| **Active** | User sessions ongoing | Normal pipeline: episode storage, profile updates, skill activations |
| **Sleep** | Session-end hook or cron job | Consolidation: memory pruning, dedup, pattern extraction, skill crystallization (GEA), profile calibration (ACE), embedding pre-computation |
| **Wake** | Next session start | Pre-loaded: refined context, calibrated profiles, mature skills, refreshed indexes |

**Sleep activities in detail**:
- Episodic pruning (below importance_score threshold)
- Semantic deduplication (merge similar Facts triples)
- Pattern extraction: recurring Episodes → Summaries (CraniMem selective transfer)
- GEA cross-agent skill validation → maturity promotions
- ACE Curate pass on all active Beliefs (drift detection)
- Cue anchor refresh (Memora, Summaries network)
- HNSW index rebuild for Experiences network

**Compute budget enforcement**: configurable max CPU/time per sleep cycle — prevents cost spirals on large memory stores.

---

## Layer 3 — Hindsight Memory

The memory layer provides persistent, cross-session, cross-repo memory through four specialized networks and three operations.

### 3.1 Four Memory Networks

#### Facts Network

**Content**: Objective, verified knowledge as knowledge graph triples.

**Schema**: `{ id, subject, predicate, object, confidence, source_organ, created_at, updated_at, embedding }`

**Key features**:
- Triple format: `(Subject, Predicate, Object)` — compatible with standard KG conventions
- Confidence scores: 0.0–1.0, updated on new evidence
- Semantic deduplication: redundant triples automatically merged
- Versioning: every triple carries timestamp + confidence history
- Source attribution: which organ or operation produced each triple

**Fed by**: Consolidated episodes (RETAIN), tool results, organ memory federation, YGN-FINANCE pipeline push.

#### Experiences Network

**Content**: Concrete interaction episodes — one episode per processed request.

**Schema**: `{ id, timestamp, caller_id, intent, entities, tools_used, organ_used, outcome, duration_ms, importance_score, embedding }`

**Importance scoring formula**:
```
score = 0.3 * novelty
      + 0.3 * outcome_significance
      + 0.2 * caller_rarity
      + 0.2 * tool_count
```

**Key features**:
- HNSW indexing (pgvector) for semantic search
- Time-range queries for recency-weighted retrieval
- Per-caller filtering for personalized recall
- Per-organ filtering for architecture learning
- Sleep-time pruning: episodes below importance threshold removed

**Fed by**: Every processed request creates one episode.

#### Summaries Network

**Content**: Entity abstractions that evolve as new experiences accumulate.

**Schema**: `{ entity_id, entity_type, primary_abstraction, cue_anchors[], concrete_values[], last_updated, version }`

**Key features**:
- **Cue anchors** ([Memora, arXiv:2602.03315](https://arxiv.org/abs/2602.03315)): keywords/concepts that expand retrieval beyond pure semantic similarity. A cue anchor for "Rust" might also match "borrow checker", "ownership", "lifetime" queries.
- **A-MEM Zettelkasten evolution** ([arXiv:2502.12110](https://arxiv.org/abs/2502.12110)): new memories trigger updates to related summaries — the network evolves without manual curation.
- **CraniMem selective transfer** ([arXiv:2603.15642](https://arxiv.org/abs/2603.15642)): sleep-time replay promotes important patterns from fast Experiences store to slow Summaries store.

**Fed by**: Sleep-time consolidation (Experiences → Summaries); organ memory federation (Meta-YGN graph nodes/edges).

#### Beliefs Network

**Content**: Subjective, per-caller behavioral profiles and preferences.

**Schema**: `{ caller_id, profile_dimensions{}, preferred_strategies{}, organ_preferences{}, skill_success_rates{}, behavioral_predictions{}, last_updated }`

**Key features**:
- Strictly isolated per `caller_id` — profiles never cross caller boundaries
- Updated via ACE (Generate/Reflect/Curate) — not simple EMA
- GDPR forget-me: complete purge by `caller_id`, cascading to all networks
- Behavioral predictions: expected architecture preference, organ routing hints, response style targets

**Fed by**: Caller Profiler (Layer 2) after every interaction.

### 3.2 Three Memory Operations

#### RETAIN (after each interaction)

Executed asynchronously after the organ response is sent — does not block response delivery.

1. Create episode → Experiences (with importance scoring)
2. Extract knowledge triples → Facts (with semantic dedup check)
3. Update impacted entity summaries → Summaries (A-MEM trigger)
4. ACE Generate + Curate → update caller profile in Beliefs

#### RECALL (on each incoming request)

Executed synchronously during request processing — results injected into organ call payload.

1. Load caller profile from Beliefs (personalization context)
2. Retrieve relevant triples from Facts (cosine similarity, pgvector HNSW)
3. Retrieve similar episodes from Experiences (HNSW + time-range + caller filter)
4. Retrieve entity context from Summaries (cue anchor expansion)
5. Federated recall: pull from organ memories via MCP (SAGE, Y-GN, Meta-YGN)
6. RRF fusion (k=60): merge STEM-local + federated results by rank

**UCB adaptive retrieval scoring**:
```
score(network) = 0.7 * cosine_similarity
               + 0.3 * (mean_reward + sqrt(2 * ln(N) / hits))
```
Networks with higher historical relevance receive more retrieval weight over time (multi-armed bandit adaptation).

#### REFLECT (sleep-time, between sessions)

Executed by Sleep-Time Compute worker. Does not run during active sessions.

1. Episodic pruning (below importance_score threshold)
2. Semantic deduplication (merge near-identical Facts triples)
3. Pattern extraction (recurring Episodes → new/updated Summaries)
4. CraniMem selective transfer (fast Experiences → slow Facts/Summaries via replay)
5. Belief recalibration (drift detection + ACE Curate pass on all active profiles)
6. Cue anchor refresh (Memora: reassess anchor relevance for each entity)

### 3.3 Memory Federation

Cross-organ memory federation — STEM reads from organ memories; organs are never modified.

| Organ | Memory System | MCP Tool | STEM Target |
|---|---|---|---|
| Y-GN | 3-tier (Hot/Warm/Cold) + HippoRAG | `ygn.memory_recall` | Facts (KG triples) |
| YGN-SAGE | S-MMU (4-view graph) + ExoCortex | `sage.memory_recall` | Facts + Experiences |
| Meta-YGN | Graph Memory (SQLite + FTS5 + UCB) | `metacog.recall` | Summaries (nodes + edges) |

**Fusion**: Reciprocal Rank Fusion (k=60) combines STEM-local and federated results. Formula: `score(d) = Σ 1 / (k + rank_i(d))` across all result lists.

**Fallback**: If an organ's circuit breaker is OPEN, its federated results are omitted. STEM-local memory still serves the recall. Gracefully degraded but never broken.

### 3.4 Storage Technology

| Technology | Role |
|---|---|
| PostgreSQL 17 | Primary store for all 4 networks, skills registry |
| pgvector | HNSW vector indexing, cosineDistance queries |
| Drizzle ORM | Type-safe queries + migrations + pgvector integration |
| Redis 7+ | Hot cache (TTL), pub/sub event streaming, rate limit counters |

---

## Layer 4 — Organ Connectors

The connector layer interfaces STEM with every execution organ in the YGN ecosystem.

### 4.1 Six Organ Connectors

| Connector | Organ | Primary Purpose |
|---|---|---|
| **ygn-connector** | Y-GN | Runtime execution: single-agent, swarm, guards, memory federation |
| **sage-connector** | YGN-SAGE | Research: topology, kNN routing, SMT verification, ExoCortex |
| **meta-connector** | Meta-YGN | Governance: Trilemma oversight, risk classification, graph memory |
| **vm-connector** | YGN-VM | Cryptographic evidence: capture → seal → verify audit packs |
| **finance-connector** | YGN-FINANCE | Knowledge: scrape → classify → score → inject into Facts |
| **evidence-connector** | nexus-evidence | Dual-agent PR review with evidence attachment |

### 4.2 Five Transport Types

| Transport | Implementation | Organs Using It |
|---|---|---|
| **MCP stdio** | Spawn subprocess, communicate via stdin/stdout | Y-GN Core, Meta-YGN (rmcp daemon) |
| **MCP Streamable HTTP** | HTTP client with streaming support | YGN-SAGE, Y-GN Brain fallback |
| **A2A client** | JSON-RPC + Agent Card discovery (`/.well-known/agent.json`) | Y-GN, YGN-SAGE |
| **uACP client** | Binary codec (19-byte header, minimal overhead) | Y-GN edge nodes |
| **CLI bridge** | Generic subprocess stdin/stdout (JSONL) | YGN-VM (aletheia), YGN-FINANCE |

### 4.3 Circuit Breakers (per organ)

Every organ connector is wrapped in a circuit breaker implementing 3-state FSM (closed / open / half_open).

**Configuration**:
- Failure threshold: 5 consecutive failures → OPEN
- Cooldown period: 30 seconds in OPEN state
- Probe: single call in HALF_OPEN → success closes, failure reopens
- Configurable per organ (different thresholds for critical vs optional organs)

**Observable states**: All circuit breaker states reported at `GET /organs` and `GET /health` endpoints.

### 4.4 Graceful Degradation

The system degrades gracefully when organs are unavailable — it never crashes due to a missing organ.

| Absent Organ | Impact | Mitigation |
|---|---|---|
| Y-GN | No single-agent execution | Route to SAGE if available; capability discovery response |
| YGN-SAGE | No topology/kNN/SMT | Route simple tasks to Y-GN; flag verification as unavailable |
| Meta-YGN | No Trilemma oversight | Architecture Selector uses conservative defaults; no self-evolution |
| YGN-VM | No cryptographic evidence | Log warning; requests processed without audit trail |
| YGN-FINANCE | No knowledge ingestion | Existing Facts network still serves recall; no new scraping |
| All organs | Standalone mode | Memory, profiling, skills registry, protocol gateway all functional |

**Standalone mode** (zero organs): STEM still provides value as a multi-protocol gateway, memory system, caller profiler, and skills registry. This ensures the component has independent utility before any organ is connected.

### 4.5 Health and Observability

| Endpoint | Data |
|---|---|
| `GET /health` | Service status, per-organ circuit breaker state, DB/Redis connectivity |
| `GET /organs` | Connected organs, declared capabilities, last heartbeat, latency p50/p99 |
| `GET /metrics` | Memory network sizes, caller counts by protocol, cache hit rates, skill activations |

Periodic heartbeat checks are sent to each organ via their health endpoints. Circuit breaker state is updated asynchronously — it does not require a request to detect organ failure.
