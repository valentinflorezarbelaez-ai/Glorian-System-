# CHANGE-079: MCP Streamable HTTP Lifecycle & Preemptive Wasm Worker Hardening

## 1. Change Metadata
- **Change ID**: `CHANGE-079`
- **Specification ID**: `SPEC-144`
- **Status**: `PROPOSED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-030`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`, `SPEC-141`, `SPEC-142`, `SPEC-143`
- **Related Decisions**: `ADR-0181`, `ADR-0182`, `ADR-0183`
- **Target Files**:
  - `src/mcp/eosMcpServer.ts`
  - `src/mcp/eosMcpStreamServer.ts`
  - `src/core/eosWasmSandboxEngine.ts`
  - `test/eosStreamWasmHardening.test.mjs`

---

## 2. Intent & Scope

### Intent
Eliminate five residual P0/P1 operational vulnerabilities identified during the engineering ground truth audit of Horizon 2:
1. Prevent Node.js host event-loop denial-of-service from arbitrary WebAssembly execution by forcing all external `args.code` payloads into worker threads with hard preemptive timeouts.
2. Prevent socket descriptor leaks in `StreamableSession.close()` by fixing the order of operations between detachment and `res.end()`.
3. Eliminate premature stream detachment by binding SSE disconnect listeners to `res.on("close")` instead of `req.on("close")`.
4. Prevent false idle session eviction by updating `lastActivity` on each transmitted keep-alive heartbeat.
5. Provide auditable backpressure and sequence gap signalling with `droppedEventsCount` and broadcast `session_closing` frames on server shutdown.

### Scope
- Enforce pre-spawn bytecode payload bounds (512 KiB max) and worker concurrency bounding.
- Guarantee worker termination across all termination branches in `executeWasmWorker()`.
- Update `StreamableSession` with local response reference capture, `res.end()` flush, idempotency guards, and dropped event auditing.
- Update `EosMcpStreamServer` HTTP routing for `GET /api/mcp` and `close()` broadcast.
- Provide comprehensive end-to-end regression test suite `test/eosStreamWasmHardening.test.mjs` validating `BDD-398` to `BDD-403`.
