# PLAN-142: Architecture Plan — Capability-Based Wasm & MicroVM Agent Sandboxing Engine

## 1. Architectural Decision Records (ADR)

### ADR-0176: Capability-Based WebAssembly & MicroVM Agent Sandboxing Architecture
- **Status**: `ACCEPTED`
- **Context**: Autonomous agents generating and running code pose severe security risks: arbitrary code execution, secret harvesting via `process.env`, resource exhaustion (fork bombs, infinite loops), and network exfiltration. Traditional VM containment (KVM, Firecracker, Hyper-V) provides hardware-grade security, but has high startup latency (500–2000ms) and fails in environments without virtualization capabilities (such as standard CI runners or serverless edge).
- **Decision**: Adopt a **Tiered Sandboxing Architecture**:
  1. **Tier 1 (Wasm Bytecode Sandbox)**: Primary execution engine for compute and transformation tasks. Bounded linear memory (1–256 pages = 64 KiB to 16 MiB), zero ambient host authority, explicit capabilities passed via imports table, sub-millisecond cold start.
  2. **Tier 2 (Hermetic Node Isolate)**: Secure sandbox for JavaScript/TypeScript agent code via `node:vm` with frozen intrinsics (`Object.freeze`), zero global `process`, `require`, `eval`, or `fetch`, and strict deterministic timeout interrupts.
  3. **Tier 3 (Hardware MicroVM Descriptors)**: Generates strict Firecracker API JSON (v1.7+) and Windows Hyper-V profiles for heavy external VM offloading.
- **Rejected Alternatives**:
  - *Unrestricted child_process execution*: Rejects all sandboxing principles; exposes entire host OS to rogue agent code.
  - *Mandatory Firecracker for all jobs*: Impracticable in non-root CI runners and serverless runtimes.
- **Consequences**:
  - Positive: Guarantees 100% portability across all operating systems without elevated privileges.
  - Positive: Zero-cold-start execution (< 1ms).

---

### ADR-0177: Zero-Cold-Start Dual-Tier Isolation (Native Wasm + Hermetic Node Isolate)
- **Status**: `ACCEPTED`
- **Context**: Big Tech operating systems (Palantir Gotham, Google Vertex, Cloudflare Workers) require deterministic trap handling where malicious or buggy guest code (out-of-bounds memory writes, integer division by zero, infinite recursions) cannot crash the control plane daemon.
- **Decision**:
  1. Wrap all `WebAssembly.Instance` executions in synchronous `try/catch` boundaries with trap classifiers:
     - `WebAssembly.RuntimeError: memory access out of bounds` -> `TRAPPED_OOB`
     - `WebAssembly.RuntimeError: unreachable` -> `TRAPPED_UNREACHABLE`
     - `RangeError: Maximum call stack size exceeded` -> `TRAPPED_STACK_OVERFLOW`
  2. In `node:vm` Isolate tier, enforce `timeout: options.timeoutMs || 2000` with `breakOnSigint: true`.
  3. Every execution returns a strictly typed `SandboxExecutionResult` with duration, memory delta, and cryptographic SHA-256 receipts.
- **Consequences**:
  - Positive: Guarantees fail-closed isolation where guest faults are safely trapped and recorded without impacting server uptime.
  - Positive: Full cryptographic audit trail committed to the durable SQLite WAL ledger.

---

## 2. Component Layout & Responsibilities

| Component | Target File | Responsibility |
|---|---|---|
| **Wasm Sandbox Engine** | `src/core/eosWasmSandboxEngine.ts` | WebAssembly instance management, linear memory bounds, trap interceptors, Node Isolate sandbox, and execution receipts |
| **MicroVM Profile Generator** | `src/core/eosWasmSandboxEngine.ts` (or `src/core/eosMicroVmSandbox.ts`) | Generates Firecracker v1.7 and Windows Hyper-V JSON specifications |
| **MCP Tool Integration** | `src/mcp/eosMcpServer.ts` & `api/mcp.js` | Exposes `eos_wasm_sandbox` tool for agents |
| **Verification Test Suite** | `test/eosWasmSandboxEngine.test.mjs` | Verification of scenarios BDD-382 to BDD-386 |
| **Verification Receipt** | `docs/evidence/EVD-SPEC-142.json` | Epistemic audit receipt upon 7-stage gate passing |
