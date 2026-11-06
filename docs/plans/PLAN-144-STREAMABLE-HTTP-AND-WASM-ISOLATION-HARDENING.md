# PLAN-144: MCP Streamable HTTP Lifecycle & Preemptive Wasm Worker Hardening

## 1. Architectural Decision Records (ADRs)

### ADR-0181: Inconditional Preemptive Worker Thread Isolation & Size Bounding for Arbitrary WebAssembly Bytecode
- **Context**: In V8, WebAssembly compilation and execution in the main thread are synchronous and non-preemptive. If a caller submits custom bytecode (`args.code`) containing an infinite loop (`loop (br 0)`), asynchronous timers (`setTimeout`) on the host event loop cannot fire until the Wasm function returns. If the routing logic relies on opt-in flags (`worker: true` or heuristic `isLoop`), malicious or obfuscated loops freeze the host indefinitely.
- **Decision**:
  1. Mandate that any invocation of `eos_wasm_sandbox` that specifies custom bytecode (`args.code`) or complex templates must unconditionally execute via `EosWasmSandboxEngine.executeWasmWorker()`. Synchronous `executeWasm()` is reserved strictly for internal benchmarks or pre-verified atomic templates (`ADD`, `TRAP`, `OOB`) when `worker: false` is explicitly set.
  2. Enforce a pre-spawn payload cap: Base64 strings or decoded byte arrays exceeding 512 KiB (524,288 bytes) are rejected with JSON-RPC error `-32602` before spawning any Worker thread.
  3. Ensure that `worker.terminate()` is called inside a `finally` block on all exit paths (success, trap, compile error, or timeout), and enforce a concurrency semaphore of max 8 concurrent active worker threads.
- **Rejected Alternatives**:
  - *Heuristic AST/Opcode Parsing*: Parsing the binary Wasm format to detect `br` targets to backward labels is complex, fragile, and bypassable by indirect branch tables (`br_table`) or mutual function recursion.
  - *Main Thread Cooperative Yielding*: Wasm MVP does not support stack suspension or cooperative yielding without asyncify transformation, which adds significant runtime overhead.
- **Consequences**: Completely eliminates host event loop DoS vulnerabilities. Prevents worker thread leaks. Adds predictable latency bounded strictly by `timeoutMs` (default 2000ms).

### ADR-0182: Streamable HTTP Session Lifecycle, Local Reference Teardown, Output Stream Disconnect & Activity Renewal
- **Context**: In `StreamableSession`, calling `this.detachResponse()` set `this.activeResponse = null` immediately, rendering subsequent checks and calls to `this.activeResponse.end()` dead code. Furthermore, listening for client disconnect on `req.on("close")` instead of `res.on("close")` resulted in premature session detachment, while heartbeats omitted updating `this.lastActivity`, causing false idle evictions.
- **Decision**:
  1. Restructure `StreamableSession.close(reason)`:
     ```typescript
     public close(reason: string = "SESSION_CLOSED"): void {
       if (this.isClosing || this.isClosed) return;
       this.isClosing = true;
       const res = this.activeResponse;
       if (res && !res.writableEnded && !res.destroyed) {
         try {
           res.write(`event: session_closing\ndata: ${JSON.stringify({ reason, sessionId: this.id })}\n\n`);
           res.end();
         } catch {
           // Handle abrupt TCP drops cleanly
         }
       }
       this.detachResponse();
       this.ringBuffer.length = 0;
       this.isClosed = true;
     }
     ```
  2. In `GET /api/mcp` and stream attachment, attach disconnect handlers to `res.on("close")` and `res.on("error")`.
  3. In `StreamableSession.sendHeartbeat()`, touch `this.lastActivity = Date.now()` upon each successful write to `res`.
- **Rejected Alternatives**:
  - *Keep `req.on("close")` alongside `res.on("close")`*: In HTTP/1.1 without keep-alive on the request entity, `req.on("close")` triggers as soon as headers are parsed, disconnecting active SSE channels prematurely.
- **Consequences**: Zero leaked socket file descriptors. Long-lived active read-only clients survive indefinitely without being falsely pruned by the idle reaper.

### ADR-0183: Backpressure Signalling via Dropped Event Sequence Auditing, Gap Frames & Graceful Shutdown
- **Context**: When streaming events exceed the 100-event ring buffer bound, shifting the oldest event without audit trails causes sequence gaps that reconnecting clients cannot identify via `Last-Event-ID`.
- **Decision**:
  1. Add `public droppedEventsCount = 0` to `StreamableSession`. Increment on every eviction shift in `addEvent()`.
  2. When `getEventsSince(lastEventId)` detects that the requested ID has been evicted (`lastEventId < oldestId - 1`), return a structured gap indicator with `droppedEventsCount`.
  3. On `EosMcpStreamServer.close()`, broadcast `event: session_closing` with `reason: "SERVER_SHUTDOWN"` to all active streamable sessions before stopping the HTTP listener.
- **Consequences**: Full epistemic visibility into backpressure drops and clean, predictable client reconnections.

---

## 2. Component Design & Implementation Details

```text
+-----------------------------------------------------------------------------------+
|                           eos_wasm_sandbox Dispatch                               |
|                                                                                   |
|  [Incoming RPC]                                                                   |
|         |                                                                         |
|         v                                                                         |
|  [Payload > 512 KiB?] -- YES --> Reject RPC -32602 (No Worker Spawn)              |
|         |                                                                         |
|        NO                                                                         |
|         v                                                                         |
|  [Custom Bytecode / Loop?]                                                        |
|         |                                                                         |
|         v                                                                         |
|  [Execute via Worker] (Concurrency <= 8)                                         |
|         |                                                                         |
|         +--> [Timeout Exceeded?] -- YES --> worker.terminate() --> TIMEOUT_KILLED |
|         |                                                                         |
|         +--> [Normal/Trap Exit]  ---------> worker.terminate() in finally         |
+-----------------------------------------------------------------------------------+
```

---

## 3. Verification Strategy

1. End-to-end testing against real HTTP servers in `test/eosStreamWasmHardening.test.mjs`.
2. Validating infinite loop termination without worker flags via MCP `tools/call`.
3. Validating socket state (`res.writableEnded === true`) upon session close.
4. Validating `res.on("close")` disconnect tracking.
5. Validating idle session retention during continuous heartbeats.
6. Validating graceful shutdown broadcasting and ring buffer dropped event counting.
