# PLAN-143: Architecture Plan — Engineering Ground Truth, Preemptive Sandbox Isolation & Attack Surface Hardening

## 1. Architectural Decision Records (ADR)

### ADR-0178: Public Serverless Tool Gating & Execution Barrier
- **Status**: `ACCEPTED`
- **Context**: In `api/mcp.js`, `eos_wasm_sandbox` was exposed on the public, unauthenticated Vercel Serverless HTTP transport. In serverless edge environments, anonymous clients should only access deterministic, read-only analysis tools (`eos_health_check`, `eos_amplify_prompt`, `eos_check_architecture`, `eos_evaluate_decision`, `eos_spotify_shuffle`, `eos_optimize_context`, `eos_slsa_provenance_sbom`, `eos_semantic_search`). Exposing arbitrary bytecode or isolate execution to unauthenticated web callers creates a compute exhaustion and abuse surface. Furthermore, `node:vm` is an evaluation convenience, NOT an attack boundary against adversaries.
- **Decision**: Remove `eos_wasm_sandbox` from `EXPOSED_TOOLS` in `api/mcp.js`. The public endpoint will reject any invocation of `eos_wasm_sandbox` fail-closed with JSON-RPC error code `-32601` ("Tool is not exposed by the read-only HTTP MCP endpoint"). Execution sandboxing is restricted to authenticated local daemons (`src/mcp/eosMcpServer.ts`, `src/mcp/eosMcpStreamServer.ts` with Bearer auth) and CLI workflows.
- **Rejected Alternatives**:
  - *Keep `eos_wasm_sandbox` open on public endpoint*: Rejected; presents unacceptable DoS and compute risk on serverless infra.
  - *Add captchas or rate limits on serverless*: Overcomplicates Layer-0 stateless architecture; read-only isolation is cleaner and foolproof.
- **Consequences**:
  - Positive: Eliminates the unauthenticated execution vector completely.
  - Positive: Aligns `api/mcp.js` with its declared design as a read-only HTTP MCP gateway.

---

### ADR-0179: Preemptive Worker Thread Isolation for Wasm Execution Deadlines
- **Status**: `ACCEPTED`
- **Context**: WebAssembly execution in V8 is compiled to native machine instructions. A synchronous WebAssembly function containing an infinite loop (`(loop (br 0))`) will lock up the main JavaScript thread completely. JavaScript timers (`setTimeout`) cannot fire because the event loop is starved.
- **Decision**: Implement an asynchronous worker thread execution path (`executeWasmWorker`) in `src/core/eosWasmSandboxEngine.ts` using native `node:worker_threads.Worker`.
  1. The worker thread compiles and runs the Wasm module.
  2. The parent thread maintains an explicit deadline timer (`setTimeout`).
  3. If the worker does not post a completion message before `timeoutMs`, the parent thread invokes `await worker.terminate()` immediately.
  4. The parent thread traps the termination, calculates duration and memory, records status `TIMEOUT_KILLED`, and commits a cryptographic receipt to the SQLite ledger without freezing the host process.
- **Rejected Alternatives**:
  - *Rely on synchronous `timeout` option*: Impossible; WebAssembly.Instance has no timeout option and blocks synchronously.
  - *Spawn external OS processes*: Slower cold start (20–50ms) vs in-process worker thread (1–3ms).
- **Consequences**:
  - Positive: Guarantees immune defense against infinite loop WebAssembly DoS attacks.
  - Positive: Zero npm dependencies (uses native `node:worker_threads`).

---

### ADR-0180: Epistemic Ground Truth & Nominal Honesty for Layer-0 Lexical-Hash Vector Projections
- **Status**: `ACCEPTED`
- **Context**: `EosHybridKnowledgeEngine` uses deterministic 64-dimensional random hash projections (FNV-1a hash over tokens and character 3-grams with position weights and L2 normalization) fused with SQLite FTS5 BM25 ranking via Reciprocal Rank Fusion ($k=60$). While mathematically rigorous, performant (< 1ms), and 100% Layer-0 pure (`dependencies: {}`), calling it "neural vector semantic search" without qualifying its lexical-hash nature introduces technical ambiguity (it does not perform transformer-based dense semantic embeddings or synonym clustering without token overlap).
- **Decision**: Update all tool descriptions, documentation, schemas, and contract catalogs (`docs/contracts/mcp-tool-catalog.json`, `src/mcp/eosMcpServer.ts`, `api/mcp.js`):
  - Accurately describe `eos_semantic_search` as: "Layer-0 Deterministic Hybrid Lexical-Vector Search: fuses SQLite FTS5 BM25 with a 64-dimensional subword n-gram hash projection via Reciprocal Rank Fusion (k=60). NOTE: Operates without external neural weights or transformers; semantic recall relies on lexical token and subword n-gram overlap."
  - In `EosHybridKnowledgeEngine.search()`, automatically check if `documentCount === 0` and trigger lazy `indexCorpus()`, guaranteeing instant out-of-the-box search across all OpenSpecs, changes, and plans.
- **Consequences**:
  - Positive: Restores total epistemic honesty and architectural transparency.
  - Positive: Out-of-the-box indexing without manual pre-run setup.

---

## 2. Component Layout & Responsibilities

| Component | Target File | Responsibility |
|---|---|---|
| **Public Serverless Endpoint** | `api/mcp.js` | Removes `eos_wasm_sandbox` from public `EXPOSED_TOOLS`, preserving strict read-only boundary |
| **Wasm Sandbox Engine** | `src/core/eosWasmSandboxEngine.ts` | Adds worker-thread preemptive Wasm execution with hard timeout termination, LOOP template, and doc clarifications |
| **Hybrid Knowledge Engine** | `src/core/eosHybridKnowledgeEngine.ts` | Lazy `indexCorpus()` on zero documents, epistemic doc clarification |
| **MCP Server Core** | `src/mcp/eosMcpServer.ts` | Ground-truth tool descriptions for `eos_semantic_search` and auto-boot indexing |
| **Streamable HTTP Server** | `src/mcp/eosMcpStreamServer.ts` | Idle session TTL reaper (15 min) and periodic keep-alive heartbeats (`: keep-alive\n\n`) on open SSE streams |
| **Contract Catalog** | `docs/contracts/mcp-tool-catalog.json` | Updated tool descriptions and hashes |
| **Verification Test Suite** | `test/eosGroundTruthHardening.test.mjs` | Verification of scenarios BDD-393 to BDD-397 |
| **Verification Receipt** | `docs/evidence/EVD-SPEC-143.json` | Epistemic audit receipt upon 7-stage gate passing |
