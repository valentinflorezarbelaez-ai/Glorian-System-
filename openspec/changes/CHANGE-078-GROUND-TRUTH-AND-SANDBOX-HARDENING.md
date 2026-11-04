# CHANGE-078: Engineering Ground Truth, Preemptive Sandbox Isolation & Attack Surface Hardening

## 1. Metadata
- **Change ID**: `CHANGE-078`
- **Spec Target**: `SPEC-143`
- **Related Specs**: `SPEC-030`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`, `SPEC-141`, `SPEC-142`
- **Architectural Decisions**: `ADR-0178`, `ADR-0179`, `ADR-0180`
- **State**: `PROPOSED`

---

## 2. Intent & Scope
1. **P0 Security Barrier in `api/mcp.js`**:
   - Remove `eos_wasm_sandbox` from `EXPOSED_TOOLS` in `api/mcp.js`. The unauthenticated public serverless endpoint is strictly read-only / deterministic; compute execution is rejected fail-closed with `-32601`.
   - Remove `eos_wasm_sandbox` validation and public tools listing overrides from `api/mcp.js`.
2. **P1 Preemptive WebAssembly Worker Isolation in `src/core/eosWasmSandboxEngine.ts`**:
   - Add `executeWasmAsync()` / `executeWasmWorker()` executing WebAssembly inside a `node:worker_threads.Worker`.
   - Implement hard timeout interruption: when `timeoutMs` expires, call `worker.terminate()`, returning `status: "TIMEOUT_KILLED"` with `exitCode: 1`.
   - Add `LOOP` template (`(loop (br 0))`) to `WASM_BYTECODE_TEMPLATES`.
   - Document explicitly that `ISOLATE` (`node:vm`) is an evaluation convenience, NOT an adversarial security sandbox.
3. **P1 Ground Truth Nominal Clarity in `src/mcp/eosMcpServer.ts` and `src/core/eosHybridKnowledgeEngine.ts`**:
   - Update descriptions of `eos_semantic_search` to reflect its true nature: Layer-0 deterministic Hybrid Lexical-Vector search (FTS5 BM25 + 64-dim FNV-1a subword n-gram hash projection with RRF $k=60$, zero external neural weights).
   - Document vocabulary limits and hash projection characteristics transparently.
4. **P1 Lazy & Automatic Corpus Indexing**:
   - Ensure `EosHybridKnowledgeEngine.search()` and `EosMcpServer` lazily trigger `indexCorpus()` when document count is zero, providing out-of-the-box search capability without manual scripts.
5. **P1 MCP Streamable HTTP Lifecycle & Heartbeat Resilience in `src/mcp/eosMcpStreamServer.ts`**:
   - Add idle session TTL reaper (sessions exceeding 15 minutes evicted).
   - Add periodic keep-alive heartbeats (`: keep-alive\n\n` every 15s) for open SSE streams on `GET /api/mcp`.
6. **Author Dedicated Test Suite `test/eosGroundTruthHardening.test.mjs`**:
   - Verify BDD-393 through BDD-397 with exit code 0.

---

## 3. Impact Assessment
- Zero new runtime npm dependencies (`package.json` -> `dependencies: {}` preserved).
- Complete elimination of unauthenticated remote execution vector on Vercel.
- Immune to WebAssembly infinite loop DoS attacks.
- 100% epistemic alignment with Big Tech truth-in-engineering doctrines.
