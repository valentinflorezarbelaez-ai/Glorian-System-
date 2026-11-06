# TASKS-140: Atomic Task DAG — Modern MCP Streamable HTTP Transport

## Task DAG
```text
Task 1: Resolve P0-a & P0-b Prerequisites (Strict Root Exemption & Provenance Labeling)
  ↳ Task 2: Refactor src/mcp/eosMcpStreamServer.ts (Full Streamable HTTP, Protocol Versions, LRU & Ring Buffer)
    ↳ Task 3: Refactor api/mcp.js (Stateless Serverless Edge, No Wildcard CORS, Safe Fallbacks)
      ↳ Task 4: Author Adversarial Test Suite test/eosMcpStreamableHttp.test.mjs (BDD-372 to BDD-376)
        ↳ Task 5: Export OpenSpec Catalog Index (140/140 Specs at 100%)
          ↳ Task 6: Execute 7-Stage verify:strict, Record EVD-SPEC-140.json, Commit & Push
```

### Task 1: Resolve P0-a & P0-b Prerequisites
- **Goal**: Confirm `scripts/eos-secret-scan.mjs` strictly checks `relPath === "index.html"` and verify regression suite.
- **Done Criteria**: `node --test test/eos-secret-scan.test.mjs` passes 16/16 tests.

### Task 2: Refactor `src/mcp/eosMcpStreamServer.ts`
- **Goal**: Implement Streamable HTTP specification:
  - Unified endpoint `POST /api/mcp` and `POST /mcp`.
  - `MCP-Protocol-Version` validation (`2025-06-18`, `2025-03-26`, `2024-11-05`).
  - Session generation via 256-bit CSPRNG, internally bound to `token_hash`.
  - LRU session eviction at capacity 16.
  - Event ring buffer (100 events / 512 KiB max) for `Last-Event-ID` resumption.
  - Timing-safe authentication with `crypto.timingSafeEqual()`.
  - 1 MiB hard payload bound with immediate stream destruction on overflow (`HTTP 413`).
  - Strict `Origin` and `Host` check against allowlist (`HTTP 403`).
- **Done Criteria**: Unit tests for stream server pass cleanly.

### Task 3: Refactor `api/mcp.js`
- **Goal**: Stateless serverless endpoint with no memory leakage, strict Origin validation, and expanded tool exposure for `eos_slsa_provenance_sbom`.
- **Done Criteria**: `api/mcp.js` handles requests statelessly without unhandled rejections.

### Task 4: Author Adversarial Test Suite
- **Goal**: Author `test/eosMcpStreamableHttp.test.mjs` verifying BDD-372 to BDD-376.
- **Done Criteria**: `node --test test/eosMcpStreamableHttp.test.mjs` exits with code 0.

### Task 5: Export OpenSpec Catalog Index
- **Goal**: Update `docs/specs/openspec-catalog-index.json` to 140 specifications.
- **Done Criteria**: `totalSpecs === 140` and `SPEC-140` status is `APPROVED`.

### Task 6: Strict Verification & Push
- **Goal**: Run `verify-cicd-pipeline.mjs`, generate `docs/evidence/EVD-SPEC-140.json`, commit, and push.
- **Done Criteria**: 7/7 stages pass with exit code 0.
