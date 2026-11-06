# CHANGE-047 — Hermetic MicroVM & Isolated Hypervisor Sandbox Engine

## Intent
Deliver SPEC-054 for EOS v60.0.0: Implement `EosMicroVmSandbox` in `src/core/eosMicroVmSandbox.ts` supporting Firecracker, Docker gVisor, and ephemeral `node:vm` sandboxing with hard memory limits (512 MB), process timeout termination, zero-network isolation, and SQLite WAL ledger recording.

## Modified Components
- `src/core/eosMicroVmSandbox.ts` (NEW: Layer-0 MicroVM & Hypervisor Sandbox engine).
- `src/mcp/eosMcpToolCatalog.ts` (Register `eos_microvm_sandbox` in tool catalog).
- `src/mcp/eosMcpServer.ts` (Handle `eos_microvm_sandbox` dispatch).
- `bin/eos.mjs` (Add `eos sandbox:vm [status|run|doctor]` command).
- `test/eosMicroVmSandbox.test.mjs` (Author BDD-185 through BDD-190 test suite).
- `docs/formal/MicroVmSandbox.tla` (NEW: TLA+ specification for MicroVM sandbox).
- `scripts/verify-formal-tla.mjs` (Add `verifyMicroVmSandboxModel`).

## Invariants Preserved
- 0 external runtime npm dependencies (`node:child_process`, `node:fs`, `node:crypto`, `node:vm`).
- Hard memory & timeout barriers preventing runaway agent execution.
- Deterministic SHA-256 receipts recorded in SQLite WAL ledger.
