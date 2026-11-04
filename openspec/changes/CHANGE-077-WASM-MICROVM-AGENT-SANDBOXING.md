# CHANGE-077: Capability-Based Wasm & MicroVM Agent Sandboxing Engine

## 1. Metadata
- **Change ID**: `CHANGE-077`
- **Spec Target**: `SPEC-142`
- **Related Specs**: `SPEC-030`, `SPEC-054`, `SPEC-073`, `SPEC-081`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`, `SPEC-141`
- **Architectural Decisions**: `ADR-0176`, `ADR-0177`
- **State**: `PROPOSED`

---

## 2. Intent & Scope
1. **Implement `src/core/eosWasmSandboxEngine.ts`**:
   - Zero-cold-start WebAssembly execution engine with capability-based security.
   - Bounded linear memory allocation using `WebAssembly.Memory({ initial: 1, maximum: 256 })` (max 16 MiB).
   - Trap isolation: intercepts WebAssembly trap errors (`RuntimeError: unreachable`, out-of-bounds access) without crashing Node.js runtime.
   - Capability-based host imports: sandboxed modules cannot access ambient I/O, network, or filesystem.
   - Fallback hermetic JS isolate sandbox with frozen intrinsics and strict timeout (`2000ms`).
   - MicroVM hypervisor configuration generator for Firecracker v1.7+ and Hyper-V.

2. **Tamper-Proof Execution Receipts & Ledger Integration**:
   - Every sandbox run produces a cryptographic execution receipt signed with SHA-256.
   - Recorded into `.eos/state/eos_sovereign_ledger.sqlite` WAL ledger.

3. **Expose MCP Tool `eos_wasm_sandbox`**:
   - Expose in `src/mcp/eosMcpServer.ts` and `api/mcp.js`.
   - Arguments: `tier` (`"WASM"` | `"ISOLATE"` | `"MICROVM_SPEC"`), `code` (string or base64 wasm), `timeoutMs`, `memoryLimitMb`.
   - Returns structured execution status, stdout, duration, memory consumed, and receipt hash.

4. **Author Adversarial Test Suite `test/eosWasmSandboxEngine.test.mjs`**:
   - Verify BDD-382 through BDD-386.

---

## 3. Impact Assessment
- Zero new runtime npm dependencies (`package.json` -> `dependencies: {}` preserved).
- Works out of the box across all OS targets (Windows, Linux, macOS) without requiring root/sudo or hardware virtualization flags.
- Sub-millisecond cold start for Wasm and Isolate execution.
