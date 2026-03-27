# YGN-STEM: Architecture

**Date**: 2026-03-27
**Status**: Approved — all 4 layers validated
**Based on**: arXiv:2603.22359 (STEM Agent) + SOTA March 2026 enhancements

---

## 1. The Four-Layer Model

YGN-STEM is structured as four vertically integrated layers. Each layer has a single responsibility and communicates downward through well-defined interfaces.

```
                        External Callers
          (AutoGen · CrewAI · LangGraph · OpenAI Agents SDK · Direct)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PROTOCOL GATEWAY                                         │
│                                                                     │
│  Purpose: Receive requests from any agent framework or protocol     │
│                                                                     │
│  Protocols  │ A2A v0.3 (JSON-RPC 2.0, SSE, gRPC)                   │
│             │ AG-UI (SSE, CopilotKit spec)                          │
│             │ A2UI (JSON, Google spec)                              │
│             │ MCP (Streamable HTTP + stdio, Linux Foundation)       │
│             │ UCP (idempotency-keyed sessions, novel)               │
│             │ AP2 (intents/mandates/receipts, novel)                │
│             │                                                       │
│  Middleware │ RequestID → Auth → RateLimit →                        │
│  (ordered)  │ CallerIdentify → Log → EvidenceCapture               │
│             │                                                       │
│  Adapters   │ AutoGen · CrewAI · LangGraph · OpenAI Agents SDK      │
│             │                                                       │
│  Tool agg.  │ Unified MCP namespace across all connected organs     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2 — ADAPTIVE INTELLIGENCE                                    │
│                                                                     │
│  Purpose: Personalize and route each request optimally              │
│                                                                     │
│  Caller     │ ACE Context Engineering (ICLR 2026)                   │
│  Profiler   │ 21 behavioral dimensions across 4 categories          │
│             │ Generate / Reflect / Curate — anti context-collapse   │
│             │ Confidence gating: conf(n) = n / (n + κ), κ=10       │
│             │                                                       │
│  Architecture│ Google Scaling Science (87% accuracy)               │
│  Selector   │ Task property analysis → architecture decision matrix  │
│             │ 6 architectures: single-agent, multi-agent, swarm,    │
│             │ adversarial, SMT pipeline, knowledge pipeline          │
│             │                                                       │
│  Skills     │ SKILL.md standard (Agent Skills, 62K+ GitHub stars)   │
│  Engine     │ Maturity lifecycle: progenitor → committed → mature   │
│             │ GEA Group Evolution: cross-agent validation            │
│             │ 71% SWE-bench Verified (vs 56.7% isolated)            │
│             │                                                       │
│  Sleep-Time │ Phase: Active → Sleep → Wake                          │
│  Compute    │ Sleep: consolidation + crystallization + calibration   │
│             │ 5x less inference compute, +18% accuracy              │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — HINDSIGHT MEMORY                                         │
│                                                                     │
│  Purpose: Maintain cross-session, cross-repo, federated memory      │
│                                                                     │
│  Facts      │ KG triples (Subject, Predicate, Object)               │
│             │ Confidence scores, versioning, semantic dedup          │
│             │                                                       │
│  Experiences│ Concrete interaction episodes                          │
│             │ Importance scoring, HNSW indexing, sleep-time pruning  │
│             │                                                       │
│  Summaries  │ Entity abstractions (Memora cue anchors)              │
│             │ A-MEM Zettelkasten evolution, version tracking         │
│             │                                                       │
│  Beliefs    │ Per-caller profiles, strictly isolated                 │
│             │ ACE updates, GDPR forget-me support                    │
│             │                                                       │
│  Operations │ RETAIN (after interaction) · RECALL (per request)     │
│             │ REFLECT (sleep-time between sessions)                 │
│             │                                                       │
│  Federation │ Read-only MCP pull from organ memories                 │
│             │ RRF fusion (k=60) for cross-repo recall                │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 4 — ORGAN CONNECTORS                                         │
│                                                                     │
│  Purpose: Interface with every YGN execution organ                  │
│                                                                     │
│  Y-GN       │ MCP stdio (primary) · MCP HTTP · A2A · uACP (edge)   │
│  YGN-SAGE   │ MCP Streamable HTTP · A2A                             │
│  Meta-YGN   │ MCP stdio (rmcp) · HTTP daemon                        │
│  YGN-VM     │ CLI subprocess bridge (aletheia stdin/stdout)         │
│  YGN-FINANCE│ Subprocess / Python import trigger                     │
│             │                                                       │
│  Resilience │ Circuit breaker per organ (closed/open/half_open)     │
│             │ 5 failures → open → 30s cooldown → half_open probe    │
│             │ Graceful degradation: absent organ = reduced caps      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                        Organ Responses
```

---

## 2. Request Flow (End-to-End)

The following traces a single request from an external caller all the way through the system and back.

```
External caller (AutoGen / CrewAI / LangGraph / OpenAI Agents SDK / direct HTTP)
  │
  │  Any of: POST /a2a  ·  GET /ag-ui/stream  ·  POST /mcp
  │          POST /a2ui/render  ·  POST /ucp/sessions  ·  POST /ap2/intents
  ▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 1: PROTOCOL GATEWAY — RECEIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │
  ├─ [1] Middleware: RequestID (UUID v7 correlation ID attached)
  ├─ [2] Middleware: Auth (JWT / OAuth2 / API Key — pluggable strategy)
  ├─ [3] Middleware: RateLimit (token bucket, per-caller, per-protocol)
  ├─ [4] Middleware: CallerIdentify (extract caller_id from auth context)
  ├─ [5] Middleware: Log (structured JSON, request/response pairs)
  └─ [6] Middleware: EvidenceCapture (async pipe to YGN-VM, non-blocking)
  │
  │  Protocol router normalizes request into internal format
  ▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 2: ADAPTIVE INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │
  ├─ [1] Caller Profiler: load profile from Beliefs (Layer 3)
  │       ACE Generate: extract behavioral signals from request
  │       Confidence gate: apply profile weight = conf(n) = n / (n + 10)
  │
  ├─ [2] Skills Engine: match request against skill registry
  │       Mature/committed skill found → shortcut to organ routing
  │       No match → continue to Architecture Selector
  │
  └─ [3] Architecture Selector: analyze task properties
          Sequential + simple      → Single agent (Y-GN MCP)
          Parallelizable + multi   → Centralized multi-agent (SAGE A2A)
          High criticality         → Adversarial RedBlue (Y-GN swarm + Meta-YGN)
          Formal verification      → SMT pipeline (SAGE Z3 + YGN-VM)
          Research / knowledge     → Knowledge pipeline (SAGE ExoCortex + FINANCE)
          Simple Q&A               → Direct LLM (Y-GN single call)
  │
  ▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 3: HINDSIGHT MEMORY — RECALL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │
  ├─ [1] Beliefs → caller profile (personalization context)
  ├─ [2] Facts → relevant KG triples (cosine similarity, pgvector HNSW)
  ├─ [3] Experiences → similar episodes (HNSW, time-range, caller filter)
  ├─ [4] Summaries → entity context (cue anchor expansion, Memora)
  └─ [5] Federated recall → organ memories via MCP
          SAGE: sage.memory_recall → S-MMU (4-view graph) + ExoCortex
          Y-GN:  ygn.memory_recall  → HippoRAG 3-tier (Hot/Warm/Cold)
          Meta:  metacog.recall     → Graph Memory (SQLite + FTS5 + UCB)
          RRF fusion (k=60) merges STEM + federated results
  │
  │  Assembled context injected into organ call payload
  ▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 4: ORGAN CONNECTORS — EXECUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │
  │  Route to selected organ(s) via appropriate transport:
  ├─ Y-GN:       MCP stdio (spawn ygn-core mcp) or MCP HTTP or A2A or uACP
  ├─ SAGE:       MCP Streamable HTTP (port 8001) or A2A (port 8002)
  ├─ Meta-YGN:   MCP stdio (rmcp daemon) or HTTP daemon (127.0.0.1:port)
  ├─ YGN-VM:     CLI stdin pipe (JSONL → aletheia capture → seal → verify)
  └─ YGN-FINANCE: subprocess trigger (scrape → classify → score → inject)
  │
  │  Circuit breaker guards every call:
  │  closed → call organ → success: stay closed / failure: increment
  │  5 failures → OPEN → wait 30s → HALF_OPEN → probe → success: close
  │
  │  Organ response received
  ▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 3: HINDSIGHT MEMORY — RETAIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │
  ├─ [1] Create episode → Experiences network (importance scored)
  ├─ [2] Extract triples → Facts network (semantic dedup applied)
  ├─ [3] Update entity summaries → Summaries network (A-MEM Zettelkasten)
  └─ [4] ACE-update caller profile → Beliefs network
          ACE Reflect: evaluate profile vs observed behavior
          ACE Curate: revise without losing nuanced insights
  │
  ▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER 1: PROTOCOL GATEWAY — RESPOND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  │
  ├─ Format response per originating protocol
  │   A2A: JSON-RPC 2.0 result envelope
  │   AG-UI: SSE event stream
  │   MCP: tool result JSON
  │   UCP: response body + idempotency receipt
  │   AP2: receipt object
  │
  └─ Evidence capture (async): pipe response event to YGN-VM (non-blocking)
  │
  ▼
External caller receives response
```

---

## 3. Memory Federation Model

YGN-STEM does not replace organ memories. It **federates** them read-only through their MCP interfaces, then fuses results with its own Hindsight networks.

### Federation Topology

```
                     ┌──────────────────────────┐
                     │   YGN-STEM Hindsight      │
                     │   (PostgreSQL + pgvector)  │
                     │                           │
                     │  Facts       Experiences  │
                     │  Summaries   Beliefs      │
                     └────────────┬─────────────┘
                                  │
                   RECALL: RRF fusion (k=60)
                   combines STEM + federated
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
   ┌─────────────┐        ┌─────────────┐        ┌──────────────┐
   │   Y-GN      │        │  YGN-SAGE   │        │  Meta-YGN    │
   │             │        │             │        │              │
   │ 3-tier mem  │        │ S-MMU       │        │ Graph Memory │
   │ Hot/Warm/   │        │ (4-view     │        │ SQLite+FTS5  │
   │ Cold +      │        │  graph) +   │        │ + UCB        │
   │ HippoRAG    │        │ ExoCortex   │        │              │
   │             │        │             │        │              │
   │ MCP tool:   │        │ MCP tool:   │        │ MCP tool:    │
   │ memory_     │        │ memory_     │        │ metacog.     │
   │ recall      │        │ recall      │        │ recall       │
   │             │        │             │        │              │
   │ → STEM      │        │ → STEM      │        │ → STEM       │
   │   Facts     │        │   Facts +   │        │   Summaries  │
   │   (triples) │        │   Experiences│       │   (nodes+    │
   └─────────────┘        └─────────────┘        │    edges)    │
                                                 └──────────────┘
```

### Federation Rules

- **Direction**: STEM pulls from organs. Organs never pull from STEM.
- **Isolation**: Organ memories are never mutated by STEM. Read-only federation.
- **Organs require zero modification**: All federation happens through existing MCP interfaces.
- **Fusion algorithm**: Reciprocal Rank Fusion (k=60) — `score(d) = Σ 1/(k + rank_i(d))`
- **UCB adaptive retrieval**: Per-network bandit scoring `0.7 * cosine + 0.3 * (mean_reward + sqrt(2 * ln(N) / hits))` — networks with higher historical relevance receive more weight over time.
- **Fallback**: If an organ is unreachable (circuit open), STEM-local memory still serves the recall. Degraded but functional.

---

## 4. Circuit Breaker Resilience Pattern

Every organ connector is wrapped in a per-organ circuit breaker implementing the standard 3-state finite state machine.

### State Machine

```
              ┌─────────────────────────────────────────┐
              │           failure_count >= 5             │
              │                                         │
   Request    │                                         ▼
─────────────►│  CLOSED  ────────────────────────►  OPEN
              │  (normal)   consecutive failures    (no calls)
              │                                         │
              │                                         │ wait 30s
              │                                         │
              │                                         ▼
              │  CLOSED  ◄──────────────────────  HALF_OPEN
              │            probe succeeds           (1 probe)
              │                                         │
              │                                         │ probe fails
              │                                         │
              │                                    back to OPEN
              └─────────────────────────────────────────┘
```

### States

| State | Behavior | Transition |
|---|---|---|
| **CLOSED** | Normal operation. All calls pass through. | 5 consecutive failures → OPEN |
| **OPEN** | All calls rejected immediately. Organ considered unavailable. | After 30s cooldown → HALF_OPEN |
| **HALF_OPEN** | Single probe call allowed. | Success → CLOSED / Failure → OPEN |

### Graceful Degradation Map

| Absent Organ | Degraded Capability | Retained Capability |
|---|---|---|
| Y-GN | Single-agent execution, swarm mode, guard checks | All other organs, memory, profiling |
| YGN-SAGE | Multi-agent topology, kNN routing, formal verification, ExoCortex RAG | Y-GN execution, memory, oversight |
| Meta-YGN | Trilemma safety oversight, risk classification, graph memory federation | Execution via Y-GN/SAGE (unguarded) |
| YGN-VM | Cryptographic evidence, audit trail | All execution (unevidenced) |
| YGN-FINANCE | Knowledge ingestion pipeline | All live execution, existing memory |

YGN-STEM in standalone mode (zero organs connected) still operates as:
- A multi-protocol gateway (capability discovery responses)
- A memory system (Hindsight 4-network independent of organs)
- A caller profiler (learns preferences without execution)
- A skills registry (stores and matches skills; cannot execute organ-dependent steps)

---

## 5. Embedding Architecture

All embeddings are computed locally — zero external API dependency.

| Model | Dimensions | Use Case | Runtime |
|---|---|---|---|
| `Snowflake/snowflake-arctic-embed-m` | 768 | Primary (general + code) | ONNX |
| `allenai/specter2_base` | 768 | Scientific / research docs | sentence-transformers |
| `naver/splade-cocondenser-ensembledistil` | sparse | Hybrid BM25+dense RECALL | sentence-transformers |
| `all-MiniLM-L6-v2` | 384 | Lightweight / edge fallback | ONNX quantized |
| Term-frequency hash | configurable | Zero-model fallback | native |

Configurable via `EMBEDDING_PROVIDER` environment variable.

---

## 6. Data Flow: Sleep-Time Compute

```
Session ends
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  SLEEP PHASE  (cron or session-end hook)             │
│                                                     │
│  Memory Consolidation                               │
│    ├─ Episodic pruning (below importance threshold) │
│    ├─ Semantic dedup (merge similar Facts triples)  │
│    └─ Pattern extraction (Episodes → Summaries)     │
│       CraniMem selective transfer: fast→slow store  │
│                                                     │
│  Skill Crystallization                              │
│    ├─ GEA cross-agent validation of progenitor      │
│    │  skills                                        │
│    └─ Maturity promotion: progenitor→committed      │
│                                                     │
│  Profile Calibration                                │
│    ├─ ACE Curate pass on all active Beliefs         │
│    └─ Drift detection (profile vs recent behavior)  │
│                                                     │
│  Pre-Computation                                    │
│    ├─ Refresh HNSW indexes for Experiences          │
│    └─ Cue anchor refresh (Memora)                   │
│                                                     │
│  Compute budget enforced (prevent cost spirals)     │
└─────────────────────────────────────────────────────┘
     │
     ▼
Next session start → pre-loaded context, refined skills,
calibrated profiles → 5x faster response, +18% accuracy
```

---

## 7. Security Architecture

Security is **not** implemented in YGN-STEM — it is **delegated** to Meta-YGN, following the separation-of-concerns principle.

| Concern | Delegated To | Interface |
|---|---|---|
| Risk classification | `metacog.classify` | MCP tool call before routing |
| Post-execution verification | `metacog.verify` | MCP tool call after organ response |
| 27-guard pipeline | Meta-YGN Guard Pipeline | HTTP daemon routes |
| Cryptographic evidence | YGN-VM Aletheia | CLI bridge (capture/seal/verify) |
| Self-Evolution Trilemma compliance | Meta-YGN external oversight | Required for Architecture Selector adaptation |

STEM's own security surface is limited to:
- Layer 1 auth middleware (JWT / OAuth2 / API Key — pluggable)
- Per-caller rate limiting (token bucket)
- Input validation via Zod v4 at all protocol boundaries
