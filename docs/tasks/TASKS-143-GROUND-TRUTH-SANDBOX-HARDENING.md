# TASKS-143: Atomic Task DAG — Engineering Ground Truth, Preemptive Sandbox Isolation & Attack Surface Hardening

## Task DAG
```text
Task 1: Eliminate Public Serverless Compute Attack Surface (api/mcp.js)
  ↳ Task 2: Implement Preemptive Wasm Worker Thread Isolation (src/core/eosWasmSandboxEngine.ts)
    ↳ Task 3: Ground Truth Nominal Documentation & Lazy Corpus Indexing (src/core/eosHybridKnowledgeEngine.ts & src/mcp/eosMcpServer.ts)
      ↳ Task 4: Transport Streamable HTTP Hardening (TTL Reaper & Heartbeat in src/mcp/eosMcpStreamServer.ts)
        ↳ Task 5: Author Dedicated Verification Suite test/eosGroundTruthHardening.test.mjs (BDD-393 to BDD-397)
          ↳ Task 6: Synchronize MCP Catalog & OpenSpec Catalog Index (143 Specs at 100%)
            ↳ Task 7: Execute 7-Stage Gate, Commit & Push to origin/main
```

---

### Task 1: Eliminate Public Serverless Compute Attack Surface (`api/mcp.js`)
- **Goal**: Remove `eos_wasm_sandbox` from unauthenticated `EXPOSED_TOOLS` in `api/mcp.js`.
- **Done Criteria**: Requests to `api/mcp.js` invoking `eos_wasm_sandbox` return JSON-RPC error `-32601` ("Tool is not exposed by the read-only HTTP MCP endpoint"). `tools/list` omits `eos_wasm_sandbox`.

### Task 2: Implement Preemptive Wasm Worker Thread Isolation (`src/core/eosWasmSandboxEngine.ts`)
- **Goal**:
  - Add `executeWasmWorker()` / `executeWasmAsync()` running WebAssembly inside `node:worker_threads.Worker`.
  - Add hard deadline timer calling `worker.terminate()` when `timeoutMs` expires.
  - Return `status: "TIMEOUT_KILLED"` with `exitCode: 1` without freezing main event loop.
  - Add `LOOP` bytecode template `(loop (br 0))` to `WASM_BYTECODE_TEMPLATES`.
  - Document that `ISOLATE` (`node:vm`) is an evaluation convenience, NOT an attack sandbox against adversaries.
- **Done Criteria**: Passing test demonstrating that a Wasm infinite loop is terminated within 100ms.

### Task 3: Ground Truth Nominal Documentation & Lazy Corpus Indexing
- **Goal**:
  - In `src/mcp/eosMcpServer.ts` and `src/core/eosHybridKnowledgeEngine.ts`, update description and documentation of `eos_semantic_search` to reflect Layer-0 Hybrid Lexical-Vector search (FTS5 BM25 + 64-dim FNV-1a hash projection with RRF $k=60$).
  - In `EosHybridKnowledgeEngine.search()`, trigger `indexCorpus()` if document count is 0.
- **Done Criteria**: `eos_semantic_search` returns results on first boot without manual setup; documentation is transparent.

### Task 4: Transport Streamable HTTP Hardening (`src/mcp/eosMcpStreamServer.ts`)
- **Goal**:
  - Add session idle TTL reaper (15 min default TTL).
  - Add periodic keep-alive heartbeats (`: keep-alive\n\n` every 15s) for open SSE streams on `GET /api/mcp`.
  - Teardown timers on socket disconnect.
- **Done Criteria**: Verified in unit tests.

### Task 5: Author Dedicated Verification Suite `test/eosGroundTruthHardening.test.mjs`
- **Goal**: Implement BDD tests for scenarios BDD-393 through BDD-397.
- **Done Criteria**: `node --test test/eosGroundTruthHardening.test.mjs` exits with code 0.

### Task 6: Synchronize MCP Catalog & OpenSpec Catalog Index
- **Goal**: Update `docs/contracts/mcp-tool-catalog.json` and catalog index with 143 formal specifications.
- **Done Criteria**: Catalog index reports 143 specs with 100% validity.

### Task 7: Execute 7-Stage Gate, Commit & Push to origin/main
- **Goal**: Run `scripts/verify-cicd-pipeline.mjs`, record `EVD-SPEC-143.json`, commit and push to `origin/main`.
- **Done Criteria**: All 7 stages pass, remote CI confirms green.
