# TASKS-142: Atomic Task DAG — Capability-Based Wasm & MicroVM Agent Sandboxing Engine

## Task DAG
```text
Task 1: Architecture Invariant Check & WebAssembly Primitives Validation
  ↳ Task 2: Implement EosWasmSandboxEngine (src/core/eosWasmSandboxEngine.ts)
    ↳ Task 3: Implement Ledger Recording & Execution Receipt Attestation
      ↳ Task 4: Upgrade MCP eos_wasm_sandbox Tool (src/mcp/eosMcpServer.ts & api/mcp.js)
        ↳ Task 5: Author Test Suite test/eosWasmSandboxEngine.test.mjs (BDD-382 to BDD-386)
          ↳ Task 6: Export OpenSpec Catalog Index (142 Specs at 100%)
            ↳ Task 7: Execute 7-Stage verify:strict, Record EVD-SPEC-142.json, Commit & Push
```

---

### Task 1: Architecture Invariant Check & WebAssembly Primitives Validation
- **Goal**: Verify native `WebAssembly.Instance`, `WebAssembly.Memory`, and trap interception in clean scratch test.
- **Done Criteria**: Scratch test executes with zero errors.

### Task 2: Implement `src/core/eosWasmSandboxEngine.ts`
- **Goal**: Implement the core sandboxing engine:
  - Wasm Bytecode runner with bounded memory (1-256 pages).
  - Capability-based host imports table.
  - Trap isolation for out-of-bounds access and unreachable instructions.
  - Hermetic JS Isolate runner via `node:vm` with frozen intrinsics and timeout protection.
  - MicroVM Firecracker v1.7 and Hyper-V profile synthesizer.
- **Done Criteria**: Class exports clean interfaces and compiles with `tsc --project tsconfig.typecheck.json`.

### Task 3: Implement Ledger Recording & Execution Receipt Attestation
- **Goal**: Cryptographic execution receipt synthesis (SHA-256) and persistence in `.eos/state/eos_sovereign_ledger.sqlite`.
- **Done Criteria**: Monotonic ledger sequence recorded on each sandbox run.

### Task 4: Upgrade MCP `eos_wasm_sandbox` Tool
- **Goal**: Expose tool in `src/mcp/eosMcpServer.ts` and `api/mcp.js`.
  - Validate parameters (`tier`, `code`, `timeoutMs`, `memoryLimitMb`).
  - Return structured result with execution ID and receipts.
- **Done Criteria**: Tool dispatch succeeds for both Wasm and Isolate tiers.

### Task 5: Author Test Suite `test/eosWasmSandboxEngine.test.mjs`
- **Goal**: Implement automated BDD tests for scenarios BDD-382 to BDD-386.
- **Done Criteria**: `node --test test/eosWasmSandboxEngine.test.mjs` exits with code 0.

### Task 6: Export OpenSpec Catalog Index
- **Goal**: Run catalog generation to include `SPEC-142` as `APPROVED`.
- **Done Criteria**: `docs/specs/openspec-catalog-index.json` reports 142 specs.

### Task 7: Strict Verification & Push
- **Goal**: Run `verify-cicd-pipeline.mjs`, generate `docs/evidence/EVD-SPEC-142.json`, commit, and push to `origin/main`.
- **Done Criteria**: 7/7 verification stages pass with exit code 0.
