# TASKS-144: Atomic Task DAG — MCP Streamable HTTP Lifecycle & Preemptive Wasm Worker Hardening

## Task DAG
```text
Task 1: Inconditional Worker Thread Isolation & Size Bounding for Arbitrary Bytecode (src/mcp/eosMcpServer.ts & src/core/eosWasmSandboxEngine.ts)
  ↳ Task 2: Fix StreamableSession Socket Lifecycle, Idempotency & Drop Counting (src/mcp/eosMcpStreamServer.ts)
    ↳ Task 3: Output Stream Disconnect Event Binding & Graceful Shutdown Broadcasting (src/mcp/eosMcpStreamServer.ts)
      ↳ Task 4: Author Dedicated Regression & Adversarial Suite test/eosStreamWasmHardening.test.mjs (BDD-398 to BDD-403)
        ↳ Task 5: Record Level 3 Implementation Authorization (IMPLEMENTATION_AUTHORIZATION.md)
          ↳ Task 6: Synchronize OpenSpec Catalog Index (144 Specifications) & Regenerate SBOM / SLSA Provenance
            ↳ Task 7: Execute Full Verification Gate, Commit & Push to origin/main
```

---

### Task 1: Inconditional Worker Thread Isolation & Size Bounding for Arbitrary Bytecode
- **Goal**:
  - In `src/mcp/eosMcpServer.ts`, enforce that any `eos_wasm_sandbox` call providing custom bytecode (`args.code`) or complex execution routes strictly via `executeWasmWorker()`.
  - Validate pre-spawn bytecode payload size (max 512 KiB); reject with `-32602` if exceeded.
  - In `src/core/eosWasmSandboxEngine.ts`, ensure worker termination in `finally` and bound active concurrent workers (max 8).
- **Done Criteria**: Passing tests verifying that custom infinite loops are killed without freezing the host event loop.

### Task 2: Fix StreamableSession Socket Lifecycle, Idempotency & Drop Counting
- **Goal**:
  - In `StreamableSession.close(reason)`:
    - Add idempotency guard (`isClosing`, `isClosed`).
    - Capture local `const res = this.activeResponse`.
    - If writable, write `event: session_closing\ndata: {"reason":"${reason}","sessionId":"${this.id}"}\n\n`.
    - Call `res.end()`.
    - Call `this.detachResponse()`.
    - Clear ring buffer.
  - In `StreamableSession.sendHeartbeat()`, touch `this.lastActivity = Date.now()` upon successful write.
  - Add `public droppedEventsCount = 0;` incremented when the ring buffer overflows.
- **Done Criteria**: `res.writableEnded` is true upon `close()`, and active heartbeats prevent idle reaping.

### Task 3: Output Stream Disconnect Event Binding & Graceful Shutdown Broadcasting
- **Goal**:
  - In `GET /api/mcp` and stream attachment, bind disconnect to `res.on("close")` and `res.on("error")` instead of `req.on("close")`.
  - In `EosMcpStreamServer.close()`, broadcast `event: session_closing` with `reason: "SERVER_SHUTDOWN"` to all active streamable sessions before stopping the HTTP server.
- **Done Criteria**: Sockets terminate cleanly without premature detachment or descriptor leaks.

### Task 4: Author Dedicated Regression & Adversarial Suite `test/eosStreamWasmHardening.test.mjs`
- **Goal**: Implement BDD tests for `BDD-398` through `BDD-403`.
- **Done Criteria**: `node --test test/eosStreamWasmHardening.test.mjs` exits with code 0.

### Task 5: Record Level 3 Implementation Authorization
- **Goal**: Update `IMPLEMENTATION_AUTHORIZATION.md` with milestone `SPEC-144 / CHANGE-079` and authorization record `AUTH-2026-11-03-STREAMABLE-WASM-HARDENING-144`.
- **Done Criteria**: Clean documentation of authorization.

### Task 6: Synchronize OpenSpec Catalog Index & Regenerate SBOM / SLSA Provenance
- **Goal**: Run `npm run sbom:generate`, update `docs/specs/openspec-catalog-index.json` to 144 specs, and update `AGENTS.md`.
- **Done Criteria**: 144 formal specs registered with 100% validity; SBOM and provenance hashes synchronized.

### Task 7: Execute Full Verification Gate, Commit & Push to origin/main
- **Goal**: Run `npm run verify:strict`, verify 153 suites pass, commit and push to remote.
- **Done Criteria**: Clean exit code 0; remote CI run succeeds.
