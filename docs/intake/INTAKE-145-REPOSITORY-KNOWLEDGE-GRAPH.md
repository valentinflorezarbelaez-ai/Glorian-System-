# INTAKE-145: Repository Knowledge Graph & Relational Impact Engine

- **Intake ID**: `INTAKE-145`
- **Change ID**: `CHANGE-080`
- **Specification ID**: `SPEC-145`
- **Architectural Decision Records**: `ADR-0184`, `ADR-0185`, `ADR-0186`
- **Standard**: IEEE 830 / ISO 29148 / SQLite WAL Graph Schema / MCP Tool Interface
- **Date**: 2026-11-03
- **Classification**: Horizon 3 Cognitive Elevation / Relational Architecture Intelligence

---

## 1. Problem Statement & Motivation

Glorian System has accumulated 144 formal OpenSpecs, 79 change deltas, over 180 ADRs, more than 400 BDD test scenarios, and 183 TypeScript/JavaScript modules. Up to Horizon 2, the retrieval and governance of this knowledge base relied on:
1. Static text scanning via regular expressions and glob patterns.
2. Lexical keyword matching with SQLite FTS5 (BM25) and subword hash projections.

While fast for textual search, this text-centric approach exhibits critical operational limitations:
* **Inability to Reason Transitively**: The system cannot compute the exact ripple effect (*blast radius*) of a proposed change. Modifying a function in `src/mcp/eosMcpStreamServer.ts` does not automatically surface which BDD tests, architectural decisions (ADRs), or high-level specifications are impacted across N hops of dependency.
* **Lack of Structural Coherence Auditing**: Detecting orphan specifications (specs with no executable BDD tests), orphan tests (BDD scenarios testing non-existent specs), or unverified architectural decisions requires manual inspection.
* **Agent Context Blindness**: Autonomous agents (Antigravity, Cursor, Claude Code) currently consume unstructured markdown prompts rather than a structured, typed relational graph of dependencies, constraints, and contracts.

---

## 2. Scope & Objectives

1. **Persistent SQLite Directed Property Graph**:
   Construct an in-process, zero-dependency directed graph schema in `data/eos_knowledge_graph.db` using native `node:sqlite` in WAL mode, with tables `eos_kg_nodes` and `eos_kg_edges`.
2. **Automated Multi-Source Entity & Relation Ingestion**:
   Deterministically ingest and extract:
   - Nodes: `SPEC`, `CHANGE`, `PLAN`, `ADR`, `BDD`, `MODULE`, `EVIDENCE`.
   - Directed Edges: `IMPLEMENTS`, `VERIFIES`, `DECIDED_BY`, `MODIFIES`, `DEPENDS_ON`, `SUPERSEDES`.
3. **Sub-Millisecond Recursive Blast Radius Engine**:
   Leverage SQLite recursive Common Table Expressions (`WITH RECURSIVE reach(...)`) to compute transitive dependency impact and upstream causality in under 5ms.
4. **Autonomous Orphan & Architectural Drift Detection**:
   Automatically identify unanchored entities, missing BDD test coverage, and broken relational invariants.
5. **Universal MCP Query Tool (`eos_query_knowledge_graph`)**:
   Expose actions (`stats`, `neighbors`, `blast_radius`, `find_orphans`, `subgraph`) through the standard MCP control plane.

---

## 3. Invariants & Governance

- **Zero Runtime NPM Dependencies (Law V)**: 100% Layer-0 pure TypeScript using built-in `node:sqlite`, `node:fs`, `node:path`, `node:crypto`.
- **Epistemic Integrity (Law III)**: Graph sync emits a deterministic SHA-256 seal of the graph topology.
- **Specification Gate (Law II)**: Complete formal package (`INTAKE-145`, `SPEC-145`, `CHANGE-080`, `PLAN-145`, `TASKS-145`) before touching production code.
