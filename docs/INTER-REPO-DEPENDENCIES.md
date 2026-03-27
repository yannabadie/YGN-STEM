# YGN-STEM: Inter-Repository Dependencies

**Critical document** — describes how YGN-STEM connects to every organ in the YGN ecosystem.

**Design principle**: STEM depends on organs. Organs do **not** depend on STEM. Organs require **zero modification** to be connected.

---

## Dependency Direction

```
                        ┌─────────────────┐
                        │    YGN-STEM      │
                        │ (this repo)      │
                        └────────┬────────┘
                                 │
                    STEM depends on organs
                    (not the other way around)
                                 │
          ┌──────────┬───────────┼───────────┬──────────┐
          │          │           │           │          │
          ▼          ▼           ▼           ▼          ▼
       ┌─────┐  ┌────────┐  ┌────────┐  ┌──────┐  ┌─────────┐
       │ Y-GN│  │YGN-SAGE│  │Meta-YGN│  │YGN-VM│  │YGN-     │
       │     │  │        │  │        │  │      │  │FINANCE  │
       └─────┘  └────────┘  └────────┘  └──────┘  └─────────┘
          │          │           │           │          │
          └──────────┴───────────┴───────────┴──────────┘
                 All organs: zero modification required
                 STEM connects through existing interfaces
                 (MCP, A2A, CLI, HTTP — already exposed)
```

**Consequence**: Every organ can be deployed, updated, and tested independently. STEM is always the integration point, never the dependency.

---

## Y-GN (Runtime Execution)

**Repository**: [github.com/yannabadie/Y-GN](https://github.com/yannabadie/Y-GN)

**Role**: Runtime execution organ. Composed of two components:
- **Brain** (Python): HiveMind orchestration, cognitive reasoning, 3-tier memory (Hot/Warm/Cold + HippoRAG)
- **Core** (Rust/Axum): High-performance execution engine, guard pipeline, swarm multi-mode (6 modes)

**Status**: 855 tests passing, v0.7.0

### Protocols

| Transport | Endpoint | Use Case | Latency |
|---|---|---|---|
| MCP stdio | `spawn: ygn-core mcp` | Primary: local subprocess (co-located) | ~1ms |
| MCP HTTP | `POST http://host:3000/mcp` | Fallback: remote / containerized | network |
| A2A | `POST http://host:3000/a2a` | Cross-instance orchestration | network |
| uACP | binary (19-byte header) | Edge / constrained nodes | minimal |

**STEM connector**: `packages/connectors/src/organs/ygn-connector.ts`

### Tools Exposed

| Tool | Description |
|---|---|
| `orchestrate` | Execute a task via Brain HiveMind (full cognitive pipeline) |
| `guard_check` | Run guard pipeline on content (27 guards) |
| `swarm_execute` | Launch swarm multi-mode execution (6 modes available) |
| `memory_recall` | Retrieve from 3-tier memory (Hot/Warm/Cold) |
| `memory_search_semantic` | Semantic search via HippoRAG embeddings |
| `orchestrate_compiled` | Execute pre-compiled task plan (skip planning phase) |
| `orchestrate_refined` | Execute with iterative refinement loop |
| `evidence_export` | Export cryptographic evidence pack to YGN-VM format |

### Memory Federation

Y-GN exposes its 3-tier memory (Hot/Warm/Cold + HippoRAG) through `ygn.memory_recall`. STEM federates these results into its **Facts network** as KG triples during RECALL, and consolidates federated facts during Sleep-Time REFLECT.

```
Y-GN 3-tier memory
  │
  │  MCP: ygn.memory_recall (read-only)
  ▼
STEM Facts network (KG triple injection)
```

### Connection Configuration

```env
YGN_CORE_MCP=stdio:ygn-core mcp         # Primary: stdio subprocess
YGN_BRAIN_MCP=http://localhost:3000/mcp  # Fallback: HTTP
YGN_A2A=http://localhost:3000/a2a        # Inter-agent
```

---

## YGN-SAGE (Research & Topology)

**Repository**: [github.com/yannabadie/YGN-SAGE](https://github.com/yannabadie/YGN-SAGE)

**Role**: Research flagship organ. Implements a 5-stage cognitive pipeline with topology generation, kNN-based routing, formal verification (Z3/SMT), ExoCortex RAG, and S-MMU multi-view graph memory.

**Status**: 1809 unit tests + 289 integration tests passing. Training pipeline active (veRL/GRPO).

### Protocols

| Transport | Port | Spec | Use Case |
|---|---|---|---|
| MCP Streamable HTTP | 8001 | FastMCP / Python | Tool calls, memory federation |
| A2A | 8002 | Starlette, 3 skills | Agent-to-agent task delegation |

**STEM connector**: `packages/connectors/src/organs/sage-connector.ts`

### Tools Exposed

| Tool | Description |
|---|---|
| `run_task` | Execute task through 5-stage cognitive pipeline |
| `topology_generate` | Generate multi-agent topology (6 path types) |
| `memory_recall` | Retrieve from S-MMU (4-view graph) + ExoCortex |
| `knn_route` | Route task to optimal agent via kNN (92% ground-truth accuracy) |
| `exocortex_search` | RAG search over ExoCortex research corpus |
| `verify_smt` | Formal verification via Z3/SMT solver |

### Memory Federation

SAGE exposes S-MMU (4-view graph memory) and ExoCortex (research corpus) through `sage.memory_recall`. STEM federates results into both **Facts** (verified knowledge triples) and **Experiences** (research episodes).

```
SAGE S-MMU (4-view graph) + ExoCortex
  │
  │  MCP: sage.memory_recall (read-only)
  ▼
STEM Facts + Experiences networks
```

### Connection Configuration

```env
SAGE_MCP=http://localhost:8001/mcp    # Primary: MCP Streamable HTTP
SAGE_A2A=http://localhost:8002/a2a    # Secondary: A2A agent protocol
```

---

## Meta-YGN (Governance & Oversight)

**Repository**: [github.com/yannabadie/Meta-YGN](https://github.com/yannabadie/Meta-YGN)

**Role**: Metacognitive control plane. Implements a 12-stage metacognitive loop, a 27-guard pipeline, and graph memory (SQLite + FTS5 + UCB). Provides external oversight required by the Self-Evolution Trilemma.

**Status**: v1.0.0, production-ready.

### Protocols

| Transport | Endpoint | Use Case |
|---|---|---|
| MCP stdio | `rmcp` daemon (fused process) | Primary: zero-hop via daemon |
| HTTP daemon | `http://127.0.0.1:{port}/hooks/*` | 16+ route groups for all hook types |

**STEM connector**: `packages/connectors/src/organs/meta-connector.ts`

### Tools Exposed

| Tool | Description |
|---|---|
| `metacog.classify` | Risk classification of task/content (pre-routing) |
| `metacog.verify` | Post-execution verification of organ results |
| `metacog.recall` | Retrieve from Graph Memory (nodes + edges) |
| `metacog.status` | Current metacognitive state, fatigue, drift metrics |
| `metacog.prune` | Prune graph memory by criteria |

### Memory Federation

Meta-YGN exposes its Graph Memory (SQLite + FTS5 + UCB) through `metacog.recall`. STEM federates graph nodes and edges into its **Summaries network** (entity abstractions with cue anchors).

```
Meta-YGN Graph Memory (SQLite + FTS5 + UCB)
  │
  │  MCP: metacog.recall (read-only)
  ▼
STEM Summaries network (entity nodes + relationship edges)
```

### Critical Role: Self-Evolution Trilemma Compliance

The Self-Evolution Trilemma ([arXiv:2602.09877](https://arxiv.org/abs/2602.09877), Feb 2026) requires that any self-modifying system maintain **external oversight**. STEM's Architecture Selector and Skills Engine both adapt over time. Neither component is allowed to evolve in isolation.

Meta-YGN is the external overseer:
- `metacog.classify` is called **before** routing any task (pre-routing safety gate)
- `metacog.verify` is called **after** receiving an organ result (post-execution audit)
- When Meta-YGN circuit breaker is OPEN, the Architecture Selector falls back to conservative defaults (single-agent, no self-evolution) until oversight is restored

### Connection Configuration

```env
META_YGN_MCP=stdio:aletheiad mcp          # Primary: stdio daemon
META_YGN_HTTP=http://127.0.0.1:7700       # Secondary: HTTP daemon
```

---

## YGN-VM (Proof Layer)

**Repository**: [github.com/yannabadie/YGN-VM](https://github.com/yannabadie/YGN-VM)

**Role**: Cryptographic evidence layer. Implements a SHA-256 hash chain, ed25519 signatures, and Merkle tree construction to produce tamper-evident audit packs of all agent actions.

**Status**: MIT license, Rust workspace.

### Protocol

YGN-VM exposes no server. It operates as a CLI tool (`aletheia`). STEM bridges to it via a TypeScript subprocess wrapper.

| Step | CLI Command | Input | Output |
|---|---|---|---|
| Capture | `aletheia capture --session S` | JSONL events via stdin | Receipt files |
| Seal | `aletheia seal --session S` | Receipt files | Signed pack |
| Verify | `aletheia verify --pack P` | Signed pack | Verification result |
| Export | `aletheia export --pack P` | Signed pack | Audit report |

**STEM connector**: `packages/connectors/src/organs/vm-connector.ts`
**Transport**: `packages/connectors/src/transports/cli-bridge.ts`

### Integration Pattern

```
STEM middleware (Layer 1 EvidenceCapture)
  │
  │  Async, non-blocking — does not add latency to request path
  │  Events: request received, organ called, response sent
  ▼
TypeScript subprocess bridge
  │  spawn aletheia, pipe JSONL events via stdin
  ▼
aletheia capture → seal → signed audit pack (SHA-256 + ed25519 + Merkle)
  │
  ▼
Audit pack stored / exportable on demand
```

The Evidence Capture middleware in Layer 1 is non-blocking by design — it queues events and writes them to the aletheia subprocess without blocking request processing.

### Connection Configuration

```env
ALETHEIA_CLI=aletheia    # Path to aletheia binary (must be on PATH)
```

### Future

A native MCP server for aletheia is planned as an upstream contribution. When available, STEM will switch from CLI bridge to MCP HTTP transport without API changes.

---

## YGN-FINANCE (Knowledge Pipeline)

**Repository**: [github.com/yannabadie/YGN-FINANCE](https://github.com/yannabadie/YGN-FINANCE)

**Role**: Knowledge ingestion pipeline. Implements a scrape → classify → score → store → push pipeline for continuous knowledge acquisition from research sources.

### Protocol

YGN-FINANCE has no persistent server. STEM triggers it via subprocess or Python import.

| Interface | Command | Use Case |
|---|---|---|
| Subprocess | `python -m src.main --once` | One-shot ingestion trigger |
| Python import | `from ygn_finance import run_pipeline` | Embedded mode |

**STEM connector**: `packages/connectors/src/organs/finance-connector.ts`

### Pipeline Stages

```
1. SCRAPE    — Pull from configured sources
               arXiv scraper   : papers by category/date
               GitHub scraper  : repos by topic/stars
               HuggingFace scraper: models/datasets/spaces
               RSS scraper     : any RSS/Atom feed

2. CLASSIFY  — Domain classification, entity extraction

3. SCORE     — Relevance scoring, novelty detection

4. STORE     — Persist to YGN-FINANCE internal store

5. PUSH      — Inject results into STEM Hindsight Facts network
               (KG triples: paper → topic, model → benchmark, etc.)
```

### Extensibility

- **New scrapers**: Implement `BaseScraper` ABC, register in config
- **New domains**: Add domain YAML config (no code change required)
- Results are always injected into STEM Facts via the same push interface, regardless of source

### Integration with STEM Memory

```
YGN-FINANCE pipeline results
  │
  │  Push interface (after STORE stage)
  ▼
STEM Facts network (KG triple injection)
  Subject: paper/model/repo
  Predicate: published_in / achieves / implements / related_to
  Object: venue / benchmark / technique / domain
```

### Connection Configuration

```env
FINANCE_PIPELINE=python -m src.main --once    # Subprocess trigger command
```

---

## Satellites

These are optional organs that extend STEM's capabilities but are not required for core operation.

### nexus-evidence

**Role**: Dual-agent PR review with cryptographic evidence attachment.

**Protocol**: MCP server

| Tool | Description |
|---|---|
| `review_pr` | Trigger dual-agent review of a GitHub pull request |
| `get_evidence` | Retrieve evidence pack for a previously reviewed PR |

**Integration**: STEM connects as an MCP client. nexus-evidence tools appear in the unified tool namespace alongside organ tools. Evidence packs produced by nexus-evidence are compatible with YGN-VM aletheia format.

### KodoClaw

**Role**: Extractible security kernel — portable, embeddable in any agent pipeline.

**Capabilities**:
- **Aho-Corasick scanner**: Multi-pattern content scanning (injection detection, PII, secrets)
- **Output guard**: Content classification before output (analogous to Meta-YGN guard, lighter weight)
- **BM25 search**: Sparse lexical retrieval over knowledge bases

**Integration**: STEM can embed KodoClaw as a library (no subprocess) or connect to it as a sidecar MCP server. When Meta-YGN is unavailable, KodoClaw provides a lightweight safety layer.

---

## Adding New Organs

STEM is designed for plug-and-play organ addition. Any system exposing MCP or A2A can be connected without modifying STEM core.

### Steps to connect a new organ

1. Implement a connector extending `BaseConnector` in `packages/connectors/src/organs/`
2. Register the connector in `OrganRegistry` (`packages/connectors/src/organ-registry.ts`)
3. Add environment variable for the organ endpoint
4. The organ's tools automatically appear in the unified MCP namespace via `ToolAggregator`
5. If the organ exposes an A2A Agent Card, auto-discovery handles steps 2-4

### Auto-discovery via A2A Agent Cards

Any organ serving a `GET /.well-known/agent.json` response compliant with A2A v0.3 will be:
- Automatically discovered when its endpoint is registered
- Auto-registered in OrganRegistry with its declared capabilities
- Its tools surfaced in the unified namespace without manual configuration
