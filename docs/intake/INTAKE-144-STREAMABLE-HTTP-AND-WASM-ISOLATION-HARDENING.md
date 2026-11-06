# INTAKE-144: MCP Streamable HTTP Lifecycle & Preemptive Wasm Worker Hardening

- **Intake ID**: `INTAKE-144`
- **Change ID**: `CHANGE-079`
- **Specification ID**: `SPEC-144`
- **Architectural Decision Records**: `ADR-0181`, `ADR-0182`, `ADR-0183`
- **Standard**: IEEE 830 / ISO 29148 / RFC 9457 / JSON-RPC 2.0 / MCP Streamable HTTP 2025-06-18
- **Date**: 2026-11-03
- **Classification**: Mission-Critical / P0 Security & Operational Integrity Hardening

---

## 1. Problem Statement & Forensic Findings

Following the delivery of `SPEC-143`, an adversarial peer engineering review identified five residual operational and security vulnerabilities in the control plane:

1. **P0 Event Loop Denial of Service via Arbitrary WebAssembly (`src/mcp/eosMcpServer.ts:5871`)**:
   The routing logic checked `if (isLoop || args?.worker === true || args?.useWorker === true)`. If an untrusted caller supplied arbitrary compiled WebAssembly bytecode via `args.code` in Base64 containing an obfuscated infinite loop (`(loop (br 0))`) without passing `worker: true`, execution fell back to synchronous `wasmSandbox.executeWasm()`. Because V8 WebAssembly linear execution in the main thread is non-preemptive, the host Node.js event loop froze indefinitely, rendering `timeoutMs` completely ineffective and causing total process denial-of-service.

2. **P1 Dead Code & Socket Descriptor Leak in `StreamableSession.close()` (`src/mcp/eosMcpStreamServer.ts:176`)**:
   `StreamableSession.close()` called `this.detachResponse()` on line 177, which immediately set `this.activeResponse = null`. The subsequent block `if (this.activeResponse && !this.activeResponse.writableEnded) { this.activeResponse.end(); }` was unreachable dead code. Active HTTP responses never received `res.end()`, leaving sockets in `CLOSE_WAIT` and leaking file descriptors under sustained traffic.

3. **P1 Erroneous Disconnect Listening on Incoming Message in SSE (`src/mcp/eosMcpStreamServer.ts:589`)**:
   `GET /api/mcp` attached the disconnect listener to `req.on("close")` instead of `res.on("close")`. In Node.js HTTP/1.1, `req.on("close")` signals completion of incoming request bytes (which for a `GET` without body happens almost immediately), which could prematurely detach the session or fail to detect client-side TCP socket drops on long-lived SSE connections.

4. **P1 False Idle Eviction of Active Read-Only SSE Clients (`src/mcp/eosMcpStreamServer.ts:139`)**:
   Periodic SSE keep-alive comments (`: keep-alive\n\n`) sent via `sendHeartbeat()` did not update `this.lastActivity = Date.now()`. Active read-only clients that only listen for server notifications were falsely marked idle and purged by `reapIdleSessions()` after 15 minutes.

5. **P1 Undeclared Backpressure Policy & Missing Graceful Teardown Notification**:
   When the bounded 100-event ring buffer overflowed, the oldest event was shifted silently without tracking or signaling data loss (`droppedEventsCount`). Additionally, server shutdown abruptly terminated connections without emitting a final `event: session_closing` SSE frame.

---

## 2. Scope & Objectives

1. **Unconditional Worker Isolation for Arbitrary Bytecode**:
   Mandate that all external `args.code` bytecode and complex executions must run inside dedicated `Worker` threads with hard `timeoutMs` preemptive kill via `worker.terminate()`.
2. **Bytecode Pre-Spawn Validation & Concurrency Limiting**:
   Enforce a maximum bytecode size limit (512 KiB) prior to worker instantiation, and limit concurrent worker spawns (max 8) to prevent OS thread exhaustion.
3. **Hermetic Socket Lifecycle & Idempotent `close()`**:
   Capture local response references prior to detachment, emit `session_closing` frames, call `res.end()`, clear timers, and enforce strict idempotency.
4. **Accurate Response Stream Teardown**:
   Bind disconnect cleanup to `res.on("close")` and `res.on("error")`.
5. **Activity Renewal on Heartbeats**:
   Touch `lastActivity = Date.now()` on every successful heartbeat dispatch.
6. **Auditable Backpressure & Gap Indication**:
   Maintain `droppedEventsCount` on buffer shifts and provide explicit sequence gap feedback.

---

## 3. Stakeholders & Invariant Guarantees

- **Lead Architect**: Valentín Flórez Arbeláez
- **Operational Requirement**: 0 runtime dependencies (`package.json` `dependencies: {}`), 100% Layer-0 Node.js standard library (`node:worker_threads`, `node:http`, `node:crypto`).
- **Target Milestones**: `CHANGE-079`, `SPEC-144`, `ADR-0181`, `ADR-0182`, `ADR-0183`, `BDD-398` through `BDD-403`.
