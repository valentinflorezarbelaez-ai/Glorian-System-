# INTAKE-143: Engineering Ground Truth, Preemptive Sandbox Isolation & Attack Surface Hardening

## 1. Context & Business Intent
- **Initiative**: Glorian System (EOS Control Plane) — Horizon 3 Gate Preparation (Hardening & Epistemic Ground Truth).
- **Requester**: Principal Architect & System Owner (Valentín Flórez Arbeláez).
- **Date**: 2026-11-03.
- **Status**: `INTAKE_APPROVED`.

### Problem Statement
Following the successful completion of Horizon 2 (SPEC-139, SPEC-140, SPEC-141, SPEC-142), a comprehensive adversarial peer review identified 5 critical operational gaps and nominal ambiguities that must be resolved to meet Palantir, Google SRE, and Anduril Tier-0 sovereign engineering standards:

1. **P0 Public Serverless Execution Surface**: In `api/mcp.js`, `eos_wasm_sandbox` was added to `EXPOSED_TOOLS`. Exposing guest isolate/wasm execution on an unauthenticated public Vercel Serverless endpoint creates an unauthorized compute vector. Furthermore, `node:vm` is an evaluation convenience, NOT an adversarial security sandbox (prototype chain escapes exist). Sandboxing must be strictly gated or restricted to authenticated persistent environments.
2. **P1 Synchronous WebAssembly DoS & Event Loop Starvation**: In `src/core/eosWasmSandboxEngine.ts`, `executeWasm()` executes synchronously on the main thread. If untrusted guest bytecode contains an infinite loop (`(loop (br 0))`), synchronous execution permanently freezes the host Node.js event loop. `timeoutMs` cannot interrupt a running synchronous WebAssembly function without dedicated preemptive thread isolation via `node:worker_threads.Worker` with `.terminate()`.
3. **P1 Epistemic Ground Truth & Nominal Honesty (SPEC-141b)**: `EosHybridKnowledgeEngine` uses deterministic 64-dimensional n-gram token hash projections (FNV-1a) fused with SQLite FTS5 BM25 via Reciprocal Rank Fusion ($k=60$). While efficient and 100% Layer-0 pure, calling this "neural vector semantic search" without explicitly documenting its lexical/hash-projection nature introduces technical credibility debt. It must be clearly identified and documented as Hybrid Lexical-Hash Vector search.
4. **P1 Automated Corpus Indexing Bootstrapping**: `indexCorpus()` was implemented in `EosHybridKnowledgeEngine` but was not automatically invoked upon `EosMcpServer` boot, requiring manual external invocation to populate the search database.
5. **P1 MCP Streamable HTTP Lifecycle Hardening (SPEC-140b)**: In `src/mcp/eosMcpStreamServer.ts`, long-running SSE connections on `GET /api/mcp` lack a periodic keep-alive heartbeat (`: keep-alive\n\n`), exposing them to proxy drops. Additionally, idle sessions accumulate in memory without an automated TTL reaper.

### Strategic Objective
Implement a comprehensive hardening and ground-truth closure package adhering strictly to Layer-0 purity (`dependencies: {}`):
1. **Public Edge Security Barrier**:
   - Remove `eos_wasm_sandbox` from unauthenticated `EXPOSED_TOOLS` in `api/mcp.js` (fail-closed 404/403).
   - Document explicitly across all contracts and codebases that `ISOLATE` (`node:vm`) is an evaluation convenience context and NOT an attack sandbox against hostile adversaries.
2. **Preemptive WebAssembly Worker Isolation**:
   - Implement asynchronous worker thread isolation (`node:worker_threads.Worker`) for Wasm execution in `src/core/eosWasmSandboxEngine.ts`.
   - Provide hard wall-clock timeout cancellation: if execution exceeds `timeoutMs`, terminate the worker thread immediately with `worker.terminate()`, returning status `TIMEOUT_KILLED` without freezing the host process.
   - Provide a deterministic infinite loop bytecode template `LOOP` in `WASM_BYTECODE_TEMPLATES` for regression verification.
3. **Epistemic Nominal Honesty & Clarity**:
   - Refactor descriptions in `src/mcp/eosMcpServer.ts`, `api/mcp.js`, and `docs/contracts/mcp-tool-catalog.json`: accurately describe `eos_semantic_search` as deterministic Layer-0 Hybrid Lexical-Vector Search (FTS5 BM25 + 64-dim token hash projection with RRF $k=60$).
4. **Bootstrapped Corpus Indexing**:
   - Wire lazy/automatic `indexCorpus()` into `EosMcpServer` and `EosHybridKnowledgeEngine.search()` when document count is zero, ensuring instant query responsiveness on first run.
5. **Transport Lifecycle Hardening**:
   - Add idle session TTL reaper (15 min eviction) in `src/mcp/eosMcpStreamServer.ts`.
   - Add periodic keep-alive heartbeats (`: keep-alive\n\n` every 15s) for open SSE streams on `GET /api/mcp`, with clean teardown on socket disconnect.

---

## 2. Inviolable Constitutional Constraints
- **Law I (Specification as Supreme Truth)**: Full formal specification (`SPEC-143`), plan (`PLAN-143`), and tasks (`TASKS-143`) before modifying production code.
- **Law II (The Strict Gate)**: Level 3 implementation authorization verified in `IMPLEMENTATION_AUTHORIZATION.md`.
- **Law III (Evidence Over Claims)**: Deterministic test evidence recorded in `docs/evidence/EVD-SPEC-143.json` with exit code 0.
- **Law V (Layer-0 Pure Purity)**: Exactly 0 runtime npm dependencies (`package.json` -> `dependencies: {}`). 100% native Node.js (`node:worker_threads`, `node:crypto`, `node:sqlite`, `node:http`).
- **Law VI (Zero Plain Secrets)**: Zero hardcoded secrets, timing-safe authorization tokens.
- **Law VII (Technical Artifact Discipline)**: English for all code, schemas, and specifications.
